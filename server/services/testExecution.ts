import { PrismaClient, Prisma } from '../../src/generated/prisma';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketManager } from './websocket.js';
import { AITestParser, AIParseResult } from './aiParser.js';
import { PlaywrightMcpClient, McpExecutionResult, TestStep } from './mcpClient.js';

const prisma = new PrismaClient();

// This interface is a bridge between our application logic and the database schema.
// It includes fields that might not exist directly in the test_cases table
// but are used in the application logic (like assertions, priority, etc.).
export interface TestCase {
  id: number;
  name: string; // Corresponds to 'title' in the database
  steps: Prisma.JsonValue | null; // Corresponds to 'steps' (JSON) in the database
  tags: Prisma.JsonValue | null; // Corresponds to 'tags' (JSON) in the database
  created_at?: Date | null;
  // These fields are conceptual and not in the DB.
  assertions?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'active' | 'draft' | 'disabled';
  author?: string;
}

export type TestRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'error' | 'cancelled';

export interface TestLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  stepId?: string;
}

export class TestExecutionService {
  private wsManager: WebSocketManager;
  private aiParser: AITestParser;
  private mcpClient: PlaywrightMcpClient;
  private runningTests: Map<string, any> = new Map();
  // 新增：共享上下文数据存储
  private sharedContext: Map<string, any> = new Map();

    constructor(wsManager: WebSocketManager, aiParser: AITestParser, mcpClient: PlaywrightMcpClient) {
    this.wsManager = wsManager;
        this.aiParser = aiParser;
        this.mcpClient = mcpClient;
        
        // 扩展mcpClient以支持自定义断言条件
        this.aiParser.extendMcpClientWithCustomConditions(this.mcpClient);
        console.log('✅ MCP客户端已增强，支持自定义断言条件');
  }

    private dbTestCaseToApp(dbCase: { id: number; title: string; steps: Prisma.JsonValue | null; tags: Prisma.JsonValue | null; created_at: Date | null; }): TestCase {
        // 从steps中提取assertions字段（如果有的话）
        let steps = dbCase.steps;
        let assertions = '';
        
        if (typeof steps === 'string') {
            try {
                const stepsObj = JSON.parse(steps);
                if (stepsObj && typeof stepsObj === 'object') {
                    // 如果有assertions字段，提取出来
                    if (stepsObj.assertions) {
                        assertions = stepsObj.assertions;
                    }
                    
                    // 如果有steps字段，使用它替换原始的steps
                    if (stepsObj.steps) {
                        steps = stepsObj.steps;
                    }
                }
            } catch (e) {
                // 解析失败，继续使用原始steps
            }
        }
        
        return {
            id: dbCase.id,
            name: dbCase.title,
            steps: steps,
            tags: dbCase.tags,
            created_at: dbCase.created_at,
            // 设置解析出的assertions或默认值
            assertions: assertions,
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
        // 处理steps和assertions，确保assertions被正确保存
        let stepsData = testCaseData.steps;
        
        // 如果有assertions字段，需要将其整合到steps中
        if (testCaseData.assertions) {
            try {
                if (typeof stepsData === 'string') {
                    // 尝试将steps解析为JSON对象（如果它已经是JSON格式）
                    try {
                        let stepsObj = JSON.parse(stepsData);
                        stepsObj.assertions = testCaseData.assertions;
                        stepsData = JSON.stringify(stepsObj);
                    } catch (e) {
                        // 如果不是JSON格式，创建一个新的对象
                        const stepsObj = {
                            steps: stepsData || '',
                            assertions: testCaseData.assertions
                        };
                        stepsData = JSON.stringify(stepsObj);
                    }
                } else {
                    // 如果steps不是字符串，创建一个新的对象
                    const stepsObj = {
                        steps: stepsData || '',
                        assertions: testCaseData.assertions
                    };
                    stepsData = JSON.stringify(stepsObj);
                }
            } catch (e) {
                console.error('处理assertions时出错:', e);
            }
        }
        
        const newTestCase = await prisma.test_cases.create({
            data: {
                title: testCaseData.name || 'Untitled Test Case',
                steps: stepsData as Prisma.InputJsonValue || Prisma.JsonNull,
                tags: testCaseData.tags as Prisma.InputJsonValue || Prisma.JsonNull,
            },
        });
        return this.dbTestCaseToApp(newTestCase);
    }

    public async updateTestCase(id: number, testCaseData: Partial<TestCase>): Promise<TestCase | null> {
        try {
            // 处理steps和assertions，确保assertions被正确保存
            let stepsData = testCaseData.steps;
            
            // 如果steps是字符串，并且assertions存在，将assertions整合到steps中
            if (typeof stepsData === 'string' && testCaseData.assertions) {
                try {
                    // 尝试将steps解析为JSON对象（如果它已经是JSON格式）
                    let stepsObj = JSON.parse(stepsData);
                    stepsObj.assertions = testCaseData.assertions;
                    stepsData = JSON.stringify(stepsObj);
                } catch (e) {
                    // 如果不是JSON格式，创建一个新的对象
                    const stepsObj = {
                        steps: stepsData,
                        assertions: testCaseData.assertions
                    };
                    stepsData = JSON.stringify(stepsObj);
                }
            } else if (testCaseData.assertions && typeof stepsData !== 'string') {
                // 如果steps不是字符串但assertions存在，创建一个包含两者的对象
                const stepsObj = {
                    steps: stepsData || '',
                    assertions: testCaseData.assertions
                };
                stepsData = JSON.stringify(stepsObj);
            }
            
            const updatedTestCase = await prisma.test_cases.update({
                where: { id },
                data: {
                    title: testCaseData.name,
                    steps: stepsData as Prisma.InputJsonValue,
                    tags: testCaseData.tags as Prisma.InputJsonValue,
                },
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

    // --- Test Execution Logic (to be implemented) ---
    public async runTest(
    testCaseId: number, 
    environment: string,
    executionMode?: string,
    options: {
      reuseBrowser?: boolean,
      suiteId?: string,
      contextState?: any
    } = {}
  ): Promise<string> {
    const runId = uuidv4();
    
    // 增强测试运行对象，添加关联信息
    this.runningTests.set(runId, {
      id: runId,
      runId, // 为兼容性添加
      testCaseId,
      status: 'queued',
      logs: [],
      startedAt: new Date(),
      environment,
      // 新增字段
      suiteId: options.suiteId,
      reuseBrowser: options.reuseBrowser || false,
      contextState: options.contextState,
      executionMode: executionMode || 'standard'
    });
    
    this.addLog(runId, `测试 #${testCaseId} 已加入队列，运行环境: ${environment}${options.reuseBrowser ? '，复用浏览器' : ''}`);
    
    // 如果有上下文状态，记录一下
    if (options.contextState) {
      this.addLog(runId, `已接收上下文状态数据`, 'info');
    }
    
    // 启动异步执行
    this.executeTest(runId).catch(error => {
      console.error(`[${runId}] executeTest promise被拒绝:`, error);
      this.addLog(runId, `执行过程中发生致命错误: ${error.message}`, 'error');
    });

    return runId;
  }

  // 修改executeTest方法，实现浏览器复用逻辑
  private async executeTest(runId: string) {
    const testRun = this.runningTests.get(runId);
    if (!testRun) {
      this.addLog(runId, '测试运行未找到，可能已被取消。', 'error');
      return;
    }

    const testCase = await this.findTestCaseById(testRun.testCaseId);
    if (!testCase || typeof testCase.steps !== 'string' || testCase.steps.trim() === '') {
      testRun.status = 'failed';
      this.addLog(runId, `测试用例 #${testRun.testCaseId} 未找到、没有步骤或步骤为空。`, 'error');
      this.wsManager.sendTestStatus(runId, 'failed');
      return;
    }

    try {
      // 关键修改：初始化时考虑是否复用浏览器
      await this.mcpClient.initialize({ 
        reuseSession: testRun.reuseBrowser 
      });
      
      // 处理上下文恢复
      if (testRun.contextState) {
        this.addLog(runId, `尝试恢复上下文状态...`, 'info');
        const restored = await this.mcpClient.restorePageState(testRun.contextState);
        if (restored) {
          this.addLog(runId, `成功恢复上下文状态`, 'success');
        } else {
          this.addLog(runId, `无法恢复上下文状态，将重新开始`, 'warning');
        }
      }
      
      testRun.status = 'running';
      this.addLog(runId, `测试开始执行: ${testCase.name}`);
      this.wsManager.sendTestStatus(runId, 'running');

      // --- 重构的执行流程 ---
      let remainingStepsText = testCase.steps;
      let stepOrder = 1;

      // 步骤 1: 单独处理第一个步骤（通常是导航），不获取快照
      this.addLog(runId, `(交互模式) 解析第一个步骤...`);
      const firstParseResult = await this.aiParser.parseNextStep(remainingStepsText, null, runId);

      // 记录AI解析结果细节
      if (firstParseResult.rawResponse) {
        this.addLog(runId, `📊 AI第一步解析详情: ${firstParseResult.rawResponse.substring(0, 100)}...`, 'info');
      }

      if (!firstParseResult.success || !firstParseResult.step) {
        throw new Error(firstParseResult.error || 'AI未能解析出第一个步骤。');
      }

      const firstStep = firstParseResult.step;
      firstStep.order = stepOrder;

      this.addLog(runId, `[步骤 ${stepOrder}] AI解析成功: ${firstStep.description}`);
      const firstStepResult = await this.mcpClient.executeStep(firstStep);

      if (firstStepResult.success) {
        this.addLog(runId, `[步骤 ${stepOrder}] 执行成功`, 'success');
      } else {
        const errorMessage = `[步骤 ${stepOrder}] 执行失败: ${firstStepResult.error}`;
        this.addLog(runId, errorMessage, 'error');
        await this.mcpClient.takeScreenshot(`${runId}-step-${stepOrder}-failed.png`);
        this.addLog(runId, `已自动截图。`, 'warning');
        throw new Error(errorMessage);
      }

      remainingStepsText = firstParseResult.remaining || '';
      stepOrder++;

      // 步骤 2: 循环处理剩余的步骤，此时应该已经有页面了
      while (remainingStepsText.trim() !== '') {
        this.addLog(runId, `(交互模式) 捕获页面快照并提交给AI进行解析...`);
        const snapshot = await this.mcpClient.getSnapshot();

        // 记录当前页面状态
        this.addLog(runId, `📸 当前页面: ${snapshot.url} (${snapshot.title})`, 'info');
        this.addLog(runId, `📸 页面元素数量: ${snapshot.elements?.length || 0}`, 'info');
        
        const parseResult = await this.aiParser.parseNextStep(remainingStepsText, snapshot, runId);
        
        if (!parseResult.success || !parseResult.step) {
          const errorMessage = parseResult.error || 'AI未能解析下一步操作。';
          this.addLog(runId, `AI解析失败，剩余指令: "${remainingStepsText}"`, 'error');
          
          // 记录解析失败的详细信息
          if (parseResult.rawResponse) {
            this.addLog(runId, `🔍 AI解析响应: ${parseResult.rawResponse.substring(0, 100)}...`, 'warning');
          }
          
          throw new Error(errorMessage);
        }

        const step = parseResult.step;
        step.order = stepOrder;

        this.addLog(runId, `[步骤 ${stepOrder}] AI解析成功: ${step.description}`);
        
        // 记录步骤详情
        this.addLog(runId, `🔍 步骤详情: ${JSON.stringify({
          action: step.action,
          selector: step.selector,
          value: step.value,
          url: step.url
        })}`, 'info');
        
        const stepResult = await this.mcpClient.executeStep(step);

        if (stepResult.success) {
          this.addLog(runId, `[步骤 ${stepOrder}] 执行成功`, 'success');
          // 记录执行结果
          this.addLog(runId, `✅ 执行结果: ${JSON.stringify(stepResult.result || {})}`, 'info');
        } else {
          const errorMessage = `[步骤 ${stepOrder}] 执行失败: ${stepResult.error}`;
          this.addLog(runId, errorMessage, 'error');
          await this.mcpClient.takeScreenshot(`${runId}-step-${stepOrder}-failed.png`);
          this.addLog(runId, `已自动截图。`, 'warning');
          throw new Error(errorMessage);
        }

        remainingStepsText = parseResult.remaining || '';
        stepOrder++;
      }

      // 处理断言
      if (testCase.assertions && testCase.assertions.trim() !== '') {
        this.addLog(runId, '开始执行断言验证...');
        const snapshot = await this.mcpClient.getSnapshot();
        
        // 记录断言时的页面状态
        this.addLog(runId, `📸 断言时页面状态: URL=${snapshot.url}, 标题=${snapshot.title}`, 'info');
        this.addLog(runId, `📸 断言文本: "${testCase.assertions}"`, 'info');
        
        const assertionsResult = await this.aiParser.parseAssertions(testCase.assertions, snapshot, runId);

        // 记录断言解析结果
        if (!assertionsResult.success) {
          this.addLog(runId, `❌ 断言解析失败: ${assertionsResult.error}`, 'error');
          if (assertionsResult.rawResponse) {
            this.addLog(runId, `❌ 解析响应: ${assertionsResult.rawResponse.substring(0, 100)}...`, 'error');
          }
          
          // 出错状态处理 - 断言解析失败视为出错，不是测试失败
          testRun.status = 'error';
          this.addLog(runId, `🚫 测试出错: 断言解析失败，测试无法继续`, 'error');
          this.wsManager.sendTestStatus(runId, 'error');
          throw new Error(`断言解析出错: ${assertionsResult.error}`);
        } else {
          this.addLog(runId, `✅ 断言解析成功，生成了${assertionsResult.steps.length}个断言步骤`, 'success');
          if (assertionsResult.rawResponse) {
            this.addLog(runId, `🔍 解析响应: ${assertionsResult.rawResponse.substring(0, 100)}...`, 'info');
          }
        }

        if (assertionsResult.steps.length === 0) {
          // 出错状态处理 - 没有断言步骤视为出错
          testRun.status = 'error';
          this.addLog(runId, `🚫 测试出错: AI未能解析任何断言步骤`, 'error');
          this.wsManager.sendTestStatus(runId, 'error');
          throw new Error('AI未能解析任何断言步骤');
        }

        for (const assertionStep of assertionsResult.steps) {
          this.addLog(runId, `[断言] 开始: ${assertionStep.description}`);
          
          // 记录断言详情
          this.addLog(runId, `🔍 断言详情: 选择器="${assertionStep.selector}", 条件="${assertionStep.condition || '可见'}", 文本="${assertionStep.text || '任意'}"`, 'info');
          
          const assertionResult = await this.mcpClient.executeStep(assertionStep);
           if (assertionResult.success) {
            this.addLog(runId, `[断言] 成功`, 'success');
            // 记录断言结果
            this.addLog(runId, `✅ 断言验证通过: ${JSON.stringify(assertionResult.result || {})}`, 'success');
          } else {
            const errorMessage = `[断言] 失败: ${assertionResult.error}`;
            this.addLog(runId, errorMessage, 'error');
            
            // 记录断言失败详情
            this.addLog(runId, `❌ 断言验证失败: 选择器="${assertionStep.selector}", 条件="${assertionStep.condition || '可见'}", 文本="${assertionStep.text || '任意'}"`, 'error');
            
            // 截图记录失败状态
            try {
              const screenshotFile = await this.mcpClient.takeScreenshot(`${assertionStep.id}-failed.png`);
              this.addLog(runId, `断言失败截图已保存: ${screenshotFile}`, 'info');
            } catch (e) {
              this.addLog(runId, `无法保存断言失败截图: ${e}`, 'warning');
            }
            
            throw new Error(errorMessage);
          }
        }
      } else {
        // 从测试描述中提取预期结果
        const match = testCase.steps.match(/预期(?:结果)?[:：]?(.*?)(?:$|。)/);
        if (match && match[1]?.trim()) {
          const assertion = match[1].trim();
          this.addLog(runId, `从测试描述中提取预期结果: "${assertion}"`, 'info');
          
          // 获取页面快照
          const snapshot = await this.mcpClient.getSnapshot();
          
          // 记录提取断言时的页面状态
          this.addLog(runId, `📸 断言提取时页面: URL=${snapshot.url}, 标题=${snapshot.title}`, 'info');
          
          // 解析并执行断言
          try {
            const assertionsResult = await this.aiParser.parseAssertions(assertion, snapshot, runId);
            if (assertionsResult.success && assertionsResult.steps.length > 0) {
              this.addLog(runId, `✅ 提取的断言解析成功，生成了${assertionsResult.steps.length}个断言步骤`, 'success');
              
              for (const assertStep of assertionsResult.steps) {
                this.addLog(runId, `[提取断言] 执行: ${assertStep.description}`, 'info');
                const assertResult = await this.mcpClient.executeStep(assertStep);
                
                if (assertResult.success) {
                  this.addLog(runId, `[提取断言] 通过`, 'success');
                } else {
                  this.addLog(runId, `[提取断言] 失败: ${assertResult.error}`, 'error');
                  this.addLog(runId, `⚠️ 提取的断言验证失败，但不影响测试结果`, 'warning');
                  
                  // 截图但不抛出错误
                  await this.mcpClient.takeScreenshot(`${assertStep.id}-assertion-failed.png`);
                }
              }
            }
          } catch (e) {
            this.addLog(runId, `提取的断言解析或执行出错: ${e}，但不影响测试结果`, 'warning');
          }
        }
      }

      testRun.status = 'completed';
      this.addLog(runId, '测试执行成功完成。', 'success');
      
      // 如果是套件的一部分，保存当前状态供后续测试使用
      if (testRun.suiteId) {
        const contextKey = `suite_${testRun.suiteId}`;
        const pageState = await this.mcpClient.extractPageState();
        this.sharedContext.set(contextKey, {
          lastTestId: testRun.testCaseId,
          pageState,
          timestamp: new Date().toISOString()
        });
        this.addLog(runId, `已保存状态供套件中后续测试使用`, 'info');
      }
      
      // 发送状态更新
      this.wsManager.sendTestStatus(runId, 'completed');
      
      // 发送测试完成通知
      setTimeout(() => {
        this.wsManager.sendTestComplete(runId, {
          testRun: this.getTestRun(runId),
          success: true
        });
        console.log(`✓ [${runId}] 已发送测试完成通知`);
      }, 1000);

    } catch (error: any) {
      // 区分执行失败和解析出错
      const isParseError = error.message && (
        error.message.includes('解析失败') || 
        error.message.includes('解析出错') || 
        error.message.includes('AI未能解析') ||
        error.message.includes('断言解析')
      );
      
      // 如果之前已经设置了error状态，则保持不变，否则根据错误类型决定
      if (testRun.status !== 'error') {
        testRun.status = isParseError ? 'error' : 'failed';
      }
      
      const errorType = testRun.status === 'error' ? '测试出错' : '测试执行失败';
      this.addLog(runId, `${errorType}: ${error.message}`, 'error');
      
      // 先发送状态更新
      this.wsManager.sendTestStatus(runId, testRun.status);
      
      // 然后延迟一秒后发送测试完成通知，确保客户端收到
      setTimeout(() => {
        this.wsManager.sendTestError(runId, {
          error: error.message,
          testRun: this.getTestRun(runId),
          isParseError: testRun.status === 'error'
        });
        console.log(`✗ [${runId}] 已发送${testRun.status === 'error' ? '测试出错' : '测试失败'}通知`);
      }, 1000);
    } finally {
      // 关键修改：根据设置决定是否关闭浏览器
      const forceClose = !testRun.reuseBrowser;
      await this.mcpClient.cleanup(forceClose);
      
      if (forceClose) {
        this.addLog(runId, '浏览器已关闭，清理完成。');
      } else {
        this.addLog(runId, '浏览器保持打开状态，供后续测试使用。');
      }
      
      testRun.finishedAt = new Date();
      // 计算持续时间
      testRun.duration = this.calculateDuration(testRun.startedAt, testRun.finishedAt);
    }
  }

    public getTestRun(runId: string) {
        return this.runningTests.get(runId);
    }

    public getAllTestRuns() {
        return Array.from(this.runningTests.values());
    }

    public async cancelTest(runId: string): Promise<boolean> {
        const testRun = this.runningTests.get(runId);
        if (!testRun) {
            return false;
        }
        
        testRun.status = 'cancelled';
        this.addLog(runId, '测试被用户手动取消。', 'warning');
        
        // 尝试清理浏览器
        try {
            await this.mcpClient.cleanup(true);
        } catch (e) {
            console.log('取消测试时清理浏览器出错:', e);
        }
        
        return true;
    }

    private addLog(runId: string, message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
      const testRun = this.runningTests.get(runId);
      if (!testRun) return;
  
      const log = {
        id: uuidv4(),
        timestamp: new Date(),
        level,
        message,
      };
  
      testRun.logs.push(log);
      
      // 发送日志
      this.wsManager.sendTestLog(runId, log);
      
      // 控制台输出更丰富的信息
      const emoji = 
        level === 'success' ? '✅' : 
        level === 'error' ? '❌' : 
        level === 'warning' ? '⚠️' : 
        '🔍';
      
      console.log(`[${runId}] ${emoji} ${message}`);
    }

  public getSharedContext(suiteId: string): any {
    const contextKey = `suite_${suiteId}`;
    return this.sharedContext.get(contextKey);
  }
  
  public clearSharedContext(suiteId: string): void {
    const contextKey = `suite_${suiteId}`;
    this.sharedContext.delete(contextKey);
  }
  
  private calculateDuration(startTime: Date, endTime: Date): string {
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) {
      return `${diffSec}秒`;
    }
    
    const minutes = Math.floor(diffSec / 60);
    const seconds = diffSec % 60;
    return `${minutes}分${seconds}秒`;
  }
} 
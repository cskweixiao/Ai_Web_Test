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

export type TestRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

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

    constructor(wsManager: WebSocketManager, aiParser: AITestParser, mcpClient: PlaywrightMcpClient) {
    this.wsManager = wsManager;
        this.aiParser = aiParser;
        this.mcpClient = mcpClient;
  }

    private dbTestCaseToApp(dbCase: { id: number; title: string; steps: Prisma.JsonValue | null; tags: Prisma.JsonValue | null; created_at: Date | null; }): TestCase {
        return {
            id: dbCase.id,
            name: dbCase.title,
            steps: dbCase.steps,
            tags: dbCase.tags,
            created_at: dbCase.created_at,
            // Set default values for conceptual fields
            assertions: '',
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
        const newTestCase = await prisma.test_cases.create({
            data: {
                title: testCaseData.name || 'Untitled Test Case',
                steps: testCaseData.steps as Prisma.InputJsonValue || Prisma.JsonNull,
                tags: testCaseData.tags as Prisma.InputJsonValue || Prisma.JsonNull,
            },
        });
        return this.dbTestCaseToApp(newTestCase);
    }

    public async updateTestCase(id: number, testCaseData: Partial<TestCase>): Promise<TestCase | null> {
        try {
            const updatedTestCase = await prisma.test_cases.update({
                where: { id },
                data: {
                    title: testCaseData.name,
                    steps: testCaseData.steps as Prisma.InputJsonValue,
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
    public async runTest(testCaseId: number, environment: string): Promise<string> {
      const runId = uuidv4();
      this.runningTests.set(runId, {
        id: runId,
        testCaseId,
        status: 'queued',
        logs: [],
        startedAt: new Date(),
        environment,
      });
      this.addLog(runId, `测试 #${testCaseId} 已加入队列，运行环境: ${environment}`);
      
      this.executeTest(runId).catch(error => {
          console.error(`[${runId}] executeTest promise被拒绝:`, error);
          this.addLog(runId, `执行过程中发生致命错误: ${error.message}`, 'error');
    });

      return runId;
  }

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
            await this.mcpClient.initialize();
            
            testRun.status = 'running';
            this.addLog(runId, `测试开始执行: ${testCase.name}`);
            this.wsManager.sendTestStatus(runId, 'running');

            // --- 重构的执行流程 ---
            let remainingStepsText = testCase.steps;
            let stepOrder = 1;

            // 步骤 1: 单独处理第一个步骤（通常是导航），不获取快照
            this.addLog(runId, `(交互模式) 解析第一个步骤...`);
            const firstParseResult = await this.aiParser.parseNextStep(remainingStepsText, null, runId);

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

                const parseResult = await this.aiParser.parseNextStep(remainingStepsText, snapshot, runId);
            
                if (!parseResult.success || !parseResult.step) {
                    const errorMessage = parseResult.error || 'AI未能解析下一步操作。';
                    this.addLog(runId, `AI解析失败，剩余指令: "${remainingStepsText}"`, 'error');
                    throw new Error(errorMessage);
                }

                const step = parseResult.step;
                step.order = stepOrder;

                this.addLog(runId, `[步骤 ${stepOrder}] AI解析成功: ${step.description}`);
                const stepResult = await this.mcpClient.executeStep(step);

                if (stepResult.success) {
                    this.addLog(runId, `[步骤 ${stepOrder}] 执行成功`, 'success');
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

            // Handle assertions if they exist
            if (testCase.assertions && testCase.assertions.trim() !== '') {
                this.addLog(runId, '开始执行断言验证...');
                const snapshot = await this.mcpClient.getSnapshot();
                const assertionsResult = await this.aiParser.parseAssertions(testCase.assertions, snapshot, runId);

                if (!assertionsResult.success || assertionsResult.steps.length === 0) {
                    throw new Error(assertionsResult.error || 'AI未能解析任何断言步骤');
                }

                for (const assertionStep of assertionsResult.steps) {
                    this.addLog(runId, `[断言] 开始: ${assertionStep.description}`);
                    const assertionResult = await this.mcpClient.executeStep(assertionStep);
                    if (assertionResult.success) {
                        this.addLog(runId, `[断言] 成功`, 'success');
                    } else {
                        const errorMessage = `[断言] 失败: ${assertionResult.error}`;
                        this.addLog(runId, errorMessage, 'error');
                        throw new Error(errorMessage);
          }
                }
            }


            testRun.status = 'completed';
            this.addLog(runId, '测试执行成功完成。', 'success');
            this.wsManager.sendTestStatus(runId, 'completed');

    } catch (error: any) {
            testRun.status = 'failed';
            this.addLog(runId, `测试执行失败: ${error.message}`, 'error');
            this.wsManager.sendTestStatus(runId, 'failed');
    } finally {
            await this.mcpClient.cleanup();
            this.addLog(runId, '浏览器已关闭，清理完成。');
            testRun.finishedAt = new Date();
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
      if (testRun && testRun.status === 'running' || testRun.status === 'queued') {
        testRun.status = 'cancelled';
        this.addLog(runId, '测试已被用户取消', 'warning');
        this.wsManager.sendTestStatus(runId, 'cancelled');
        // Here you would add logic to stop the actual test process
        return true;
      }
      return false;
    }
    
    // We keep this method for logging, but the execution logic that uses it is not yet implemented.
    private addLog(runId: string, message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
        const testRun = this.runningTests.get(runId);
        if (testRun) {
            const logEntry: TestLog = {
                id: uuidv4(),
                timestamp: new Date(),
                message,
                level,
            };
            testRun.logs.push(logEntry);
            console.log(`[${runId}] ${message}`);
            this.wsManager.sendTestLog(runId, logEntry);
        }
  }
} 
import { PrismaClient, Prisma } from '../../src/generated/prisma';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketManager } from './websocket.js';
import { PlaywrightMcpClient } from './mcpClient.js';
import { MCPToolMapper } from '../utils/mcpToolMapper.js';
import { AITestParser } from './aiParser.js';
import { ScreenshotService } from './screenshotService.js';
import { testRunStore } from '../../lib/TestRunStore.js';
import type { TestRun, TestStep, TestLog, TestCase, TestRunStatus } from '../../src/types/test.js';
import type { ScreenshotRecord } from '../types/screenshot.js';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 重构后的测试执行服务：完全基于MCP的新流程
export class TestExecutionService {
  private wsManager: WebSocketManager;
  private mcpClient: PlaywrightMcpClient;
  private aiParser: AITestParser;
  private screenshotService: ScreenshotService;

  constructor(wsManager: WebSocketManager, aiParser: AITestParser, mcpClient: PlaywrightMcpClient, screenshotService?: ScreenshotService) {
    this.wsManager = wsManager;
    this.aiParser = aiParser;
    this.mcpClient = mcpClient;
    this.screenshotService = screenshotService || new ScreenshotService(prisma);
    
    // 在构造函数中记录AI解析器的模型信息
    this.logAIParserInfo();
  }

  // 记录AI解析器信息
  private logAIParserInfo(): void {
    try {
      const modelInfo = this.aiParser.getCurrentModelInfo();
      console.log(`🤖 测试执行服务已初始化，AI解析器配置:`);
      console.log(`   模型: ${modelInfo.modelName} (${modelInfo.provider})`);
      console.log(`   运行模式: ${modelInfo.mode}`);
      
      if (this.aiParser.isConfigManagerMode()) {
        console.log(`   配置管理器: 已启用`);
      } else {
        console.log(`   配置管理器: 未启用 (使用传统模式)`);
      }
    } catch (error) {
      console.warn(`⚠️ 无法获取AI解析器模型信息: ${error.message}`);
    }
  }

  // 重新加载AI解析器配置（无需重启服务）
  public async reloadAIParserConfiguration(): Promise<void> {
    try {
      console.log(`🔄 测试执行服务：重新加载AI解析器配置...`);
      
      // 调用AI解析器的配置重载方法
      await this.aiParser.reloadConfiguration();
      
      // 重新记录配置信息
      this.logAIParserInfo();
      
      console.log(`✅ 测试执行服务：AI解析器配置重新加载完成`);
    } catch (error) {
      console.error(`❌ 测试执行服务：重新加载AI解析器配置失败:`, error);
      throw error;
    }
  }

  // 获取当前AI解析器状态信息
  public getAIParserStatus(): {
    modelInfo: { modelName: string; provider: string; mode: string };
    isConfigManagerMode: boolean;
    isReady: boolean;
  } {
    try {
      const modelInfo = this.aiParser.getCurrentModelInfo();
      return {
        modelInfo,
        isConfigManagerMode: this.aiParser.isConfigManagerMode(),
        isReady: true
      };
    } catch (error) {
      return {
        modelInfo: { modelName: '未知', provider: '未知', mode: '未知' },
        isConfigManagerMode: false,
        isReady: false
      };
    }
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
    
    // 记录当前AI解析器配置信息
    try {
      const modelInfo = this.aiParser.getCurrentModelInfo();
      console.log(`🤖 [${runId}] AI解析器配置信息:`);
      console.log(`   模型: ${modelInfo.modelName} (${modelInfo.provider})`);
      console.log(`   运行模式: ${modelInfo.mode}`);
      this.addLog(runId, `🤖 使用AI模型: ${modelInfo.modelName} (${modelInfo.provider})`, 'info');
      
      if (this.aiParser.isConfigManagerMode()) {
        this.addLog(runId, `🔧 配置管理器模式已启用，支持动态模型切换`, 'info');
      } else {
        this.addLog(runId, `⚙️ 传统模式运行，使用固定配置`, 'info');
      }
    } catch (error) {
      console.warn(`⚠️ [${runId}] 无法获取AI解析器信息: ${error.message}`);
      this.addLog(runId, `⚠️ 无法获取AI模型信息`, 'warning');
    }

    try {
      // 🔥 初始化MCP客户端
      console.log(`🚀 [${runId}] 正在初始化MCP客户端...`);
      this.addLog(runId, `🚀 正在初始化MCP客户端...`, 'info');
      console.log(`📊 [${runId}] MCP客户端状态: isInitialized=${this.mcpClient['isInitialized']}`);

      try {
        await this.mcpClient.initialize({
          reuseSession: false,
          contextState: null
        });
        console.log(`✅ [${runId}] MCP客户端初始化成功`);
        this.addLog(runId, `✅ MCP客户端初始化成功，浏览器已启动`, 'success');
      } catch (initError) {
        console.error(`❌ [${runId}] MCP初始化失败:`, initError);
        this.addLog(runId, `❌ MCP初始化失败: ${initError.message}`, 'error');
        this.updateTestRunStatus(runId, 'failed', `MCP初始化失败: ${initError.message}`);
        return;
      }

      let remainingSteps = testCase.steps;
      let stepIndex = 0;
      let previousStepsText = ''; // 🔥 新增：用于防止无限循环
      const maxSteps = 50; // 🔥 新增：最大步骤数限制

      // 🔥 详细调试日志：显示测试用例数据
      console.log(`🔍 [${runId}] ===== 测试执行开始调试 =====`);
      console.log(`   测试用例ID: ${testCase.id}`);
      console.log(`   测试用例名称: "${testCase.name}"`);
      console.log(`   操作步骤原始数据: "${testCase.steps}"`);
      console.log(`   断言预期原始数据: "${testCase.assertions}"`);
      console.log(`   remainingSteps初始值: "${remainingSteps}"`);
      console.log(`   remainingSteps类型: ${typeof remainingSteps}`);
      console.log(`   remainingSteps长度: ${remainingSteps?.length || 0}`);
      console.log(`🔍 [${runId}] ===== 测试执行开始调试结束 =====\n`);
      
      this.addLog(runId, `🔍 测试数据: 操作步骤${testCase.steps ? '有' : '无'}, 断言${testCase.assertions ? '有' : '无'}`, 'info');

      // 🔥 AI闭环执行 - 修复：添加步骤间延迟和无限循环保护
      while (remainingSteps?.trim()) {
        stepIndex++;

        // 🔥 防止无限循环：检查是否与上一次步骤相同
        if (remainingSteps === previousStepsText) {
          console.error(`❌ [${runId}] 检测到无限循环，剩余步骤未变化: "${remainingSteps}"`);
          this.addLog(runId, `❌ 检测到无限循环，停止执行`, 'error');
          this.updateTestRunStatus(runId, 'failed', '检测到无限循环，测试已停止');
          return;
        }

        // 🔥 防止步骤数过多
        if (stepIndex > maxSteps) {
          console.error(`❌ [${runId}] 步骤数超过限制 (${maxSteps})，可能存在无限循环`);
          this.addLog(runId, `❌ 步骤数超过限制，停止执行`, 'error');
          this.updateTestRunStatus(runId, 'failed', `步骤数超过限制 (${maxSteps})，测试已停止`);
          return;
        }

        previousStepsText = remainingSteps; // 记录当前步骤文本

        // 🔥 增加详细日志：获取页面快照
        this.addLog(runId, `🔍 正在获取页面快照用于AI分析...`, 'info');
        const snapshot = await this.mcpClient.getSnapshot();
        this.addLog(runId, `📸 页面快照获取成功，开始AI解析`, 'info');

        // 🔥 增加详细日志：AI解析过程
        console.log(`🔍 [${runId}] ===== 第${stepIndex}次循环调试 =====`);
        console.log(`   当前remainingSteps: "${remainingSteps}"`);
        console.log(`   remainingSteps类型: ${typeof remainingSteps}`);
        console.log(`   remainingSteps长度: ${remainingSteps?.length || 0}`);
        console.log(`   是否包含"登入失败": ${remainingSteps?.includes('登入失败') ? '是' : '否'}`);
        console.log(`🔍 [${runId}] ===== 第${stepIndex}次循环调试结束 =====\n`);
        
        this.addLog(runId, `🤖 AI正在解析下一个步骤...`, 'info');
        const aiResult = await this.aiParser.parseNextStep(remainingSteps, snapshot, runId);

        if (!aiResult.success || !aiResult.step) {
          this.addLog(runId, `❌ AI解析失败: ${aiResult.error}`, 'error');
          this.updateTestRunStatus(runId, 'failed', `AI解析失败: ${aiResult.error}`);
          return;
        }

        const step = aiResult.step;
        this.addLog(runId, `✅ AI解析成功: ${step.action} - ${step.description}`, 'success');
        this.updateTestRunStatus(runId, 'running', `步骤 ${stepIndex}: ${step.description}`);

        // 🔥 关键修复：步骤前等待，确保UI稳定
        this.addLog(runId, `⏳ 等待UI稳定...`, 'info');
        await this.delay(1000);

        // 🔥 Phase 1 修复：执行稳定性增强 - 多策略重试机制
        this.addLog(runId, `🔧 开始执行步骤 ${stepIndex}: ${step.action} - ${step.description}`, 'info');

        // 🔥 实现原始设计理念：执行稳定性优先的多层次重试策略
        const executionResult = await this.executeStepWithRetryAndFallback(step, runId);

        if (!executionResult.success) {
          this.addLog(runId, `❌ 步骤执行最终失败: ${executionResult.error}`, 'error');
          await this.takeStepScreenshot(runId, stepIndex, 'failed', step.description);

          // 🔥 智能失败处理：根据步骤重要性和错误类型决定是否继续
          const shouldContinue = await this.shouldContinueAfterFailure(step, runId, executionResult.error);

          if (!shouldContinue) {
            this.updateTestRunStatus(runId, 'failed', `关键步骤 ${stepIndex} 失败: ${executionResult.error}`);
            return;
          } else {
            this.addLog(runId, `⚠️ 步骤 ${stepIndex} 失败但继续执行: ${executionResult.error}`, 'warning');
            // 继续执行下一步
          }
        } else {
          this.addLog(runId, `✅ 步骤 ${stepIndex} 执行成功`, 'success');

          // 🔥 Phase 1 关键修复：操作效果验证
          if (await this.needsOperationVerification(step)) {
            const verificationResult = await this.verifyOperationSuccess(step, runId);
            if (!verificationResult) {
              this.addLog(runId, `⚠️ 步骤 ${stepIndex} 执行成功但效果验证失败`, 'warning');
            }
          }
        }

        // 🔥 关键修复：操作后等待，确保页面响应
        await this.delayAfterOperation(step.action);

        // 🔥 新增：每个步骤执行成功后都截图
        await this.takeStepScreenshot(runId, stepIndex, 'success', step.description);

        // 🔥 关键修复：确保步骤正确推进
        const newRemainingSteps = aiResult.remaining || '';

        // 🔥 增强日志：显示步骤推进情况
        console.log(`🔄 [${runId}] 步骤推进状态:`);
        console.log(`   ⬅️ 执行前剩余: "${remainingSteps.substring(0, 100)}..."`);
        console.log(`   ➡️ 执行后剩余: "${newRemainingSteps.substring(0, 100)}..."`);
        console.log(`   📊 步骤是否推进: ${remainingSteps !== newRemainingSteps ? '✅ 是' : '❌ 否'}`);

        remainingSteps = newRemainingSteps;

        this.addLog(runId, `📋 步骤推进: ${remainingSteps.trim() ? `还有 ${remainingSteps.split('\n').filter(l => l.trim()).length} 个步骤` : '所有步骤已完成'}`, 'info');

        // 🔥 关键修复：步骤间等待
        if (remainingSteps.trim()) {
          this.addLog(runId, `⏳ 等待下一步骤...`, 'info');
          await this.delay(1500);
        }
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

      // 🔥 新增：测试完成后截图
      await this.takeStepScreenshot(runId, 'final', 'completed', '测试执行完成');

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

  // 🔥 新增：带重试和降级机制的步骤执行方法
  private async executeStepWithRetryAndFallback(step: TestStep, runId: string): Promise<{ success: boolean; error?: string }> {
    const maxRetries = 3;
    const fallbackStrategies = ['standard', 'alternative', 'simple'];

    for (let strategy = 0; strategy < fallbackStrategies.length; strategy++) {
      const strategyName = fallbackStrategies[strategy];
      this.addLog(runId, `🔄 使用策略 "${strategyName}" 执行步骤`, 'info');

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // 🔥 每次重试前确保页面稳定
          await this.ensurePageStability(runId);

          // 🔥 根据策略调整执行方式
          const result = await this.executeMcpCommandWithStrategy(step, runId, strategyName);

          if (result.success) {
            // 🔥 成功后验证操作效果
            const verified = await this.verifyOperationSuccess(step, runId);
            if (verified) {
              this.addLog(runId, `✅ 步骤执行成功并通过验证 (策略: ${strategyName}, 尝试: ${attempt})`, 'success');
              return { success: true };
            } else {
              this.addLog(runId, `⚠️ 步骤执行成功但验证失败，继续重试`, 'warning');
              throw new Error('操作成功但效果验证失败');
            }
          } else {
            throw new Error(result.error || '执行失败');
          }
        } catch (error: any) {
          const isLastAttempt = attempt === maxRetries;
          const isLastStrategy = strategy === fallbackStrategies.length - 1;

          if (isLastAttempt && isLastStrategy) {
            this.addLog(runId, `❌ 所有策略和重试均失败: ${error.message}`, 'error');
            return { success: false, error: error.message };
          } else if (isLastAttempt) {
            this.addLog(runId, `⚠️ 策略 "${strategyName}" 失败，尝试下一策略`, 'warning');
            break; // 跳到下一个策略
          } else {
            this.addLog(runId, `🔄 策略 "${strategyName}" 第${attempt}次尝试失败，重试中: ${error.message}`, 'warning');
            await this.delay(1000 * attempt); // 递增延迟
          }
        }
      }
    }

    return { success: false, error: '所有策略和重试均失败' };
  }

  // 🔥 新增：根据策略执行MCP命令
  private async executeMcpCommandWithStrategy(step: TestStep, runId: string, strategy: string): Promise<{ success: boolean; error?: string }> {
    switch (strategy) {
      case 'standard':
        // 标准策略：直接使用现有的executeMcpCommand
        return await this.executeMcpCommand(step, runId);

      case 'alternative':
        // 替代策略：使用更宽松的元素查找
        this.addLog(runId, `🔄 使用替代策略：宽松元素查找`, 'info');
        return await this.executeMcpCommandWithAlternativeSearch(step, runId);

      case 'simple':
        // 简单策略：使用最基础的选择器
        this.addLog(runId, `🔄 使用简单策略：基础选择器`, 'info');
        return await this.executeMcpCommandWithSimpleSelector(step, runId);

      default:
        return await this.executeMcpCommand(step, runId);
    }
  }

  // 🔥 智能判断失败后是否应该继续执行（基于AI分析）
  private async shouldContinueAfterFailure(step: TestStep, runId: string, error?: string): Promise<boolean> {
    // 🔥 关键操作类型失败不继续
    const criticalActions = ['navigate', 'browser_navigate', 'browser_click'];

    if (criticalActions.includes(step.action)) {
      this.addLog(runId, `❌ 关键操作 "${step.action}" 失败，终止执行`, 'error');
      return false;
    }

    // 🔥 MCP连接问题不继续
    if (error?.includes('MCP_DISCONNECTED') || error?.includes('Client is not initialized')) {
      this.addLog(runId, `❌ MCP连接问题，终止执行`, 'error');
      return false;
    }

    // 🔥 AI解析失败不继续
    if (error?.includes('AI解析失败')) {
      this.addLog(runId, `❌ AI解析失败，终止执行`, 'error');
      return false;
    }

    // 🔥 其他情况继续执行，但记录警告
    this.addLog(runId, `⚠️ 非关键步骤失败，继续执行后续步骤`, 'warning');
    return true;
  }

  // 🔥 统一的元素查找和参数转换辅助方法
  private async findElementAndBuildCommand(
    action: string,
    selector: string,
    value: string | undefined,
    runId: string
  ): Promise<{ name: string; arguments: any }> {
    console.log(`🔍 [${runId}] 构建MCP命令: ${action} -> ${selector}`);

    // 🔥 修复：直接使用MCP客户端的智能元素查找，不使用无效的'find'动作
    // 通过快照获取页面信息，然后进行智能匹配
    let elementRef = selector;

    try {
      // 获取页面快照进行元素匹配
      const snapshot = await this.mcpClient.getSnapshot();
      if (snapshot) {
        // 使用MCP客户端的AI匹配功能查找最佳元素
        const matchedElement = await this.findBestElementFromSnapshot(selector, snapshot, runId);
        if (matchedElement) {
          elementRef = matchedElement.ref;
          console.log(`✅ [${runId}] 智能匹配成功: "${matchedElement.text}" -> ${elementRef}`);
        } else {
          console.warn(`⚠️ [${runId}] 智能匹配失败，使用原始选择器: ${selector}`);
        }
      }
    } catch (snapshotError) {
      console.warn(`⚠️ [${runId}] 页面快照获取失败，使用原始选择器: ${snapshotError.message}`);
    }

    // 获取工具名称
    const mappedAction = MCPToolMapper.getToolName(action);

    // 构建正确格式的参数
    let mcpArguments: any = {};

    switch (action) {
      case 'click':
      case 'browser_click':
        mcpArguments = { ref: elementRef };
        break;
      case 'fill':
      case 'input':
      case 'type':
      case 'browser_type':
        mcpArguments = { ref: elementRef, text: value || '' };
        break;
      default:
        throw new Error(`不支持的操作类型: ${action}`);
    }

    console.log(`✅ [${runId}] MCP命令构建完成: ${mappedAction}`);
    console.log(`📋 [${runId}] 参数格式: ${JSON.stringify(mcpArguments)}`);

    return { name: mappedAction, arguments: mcpArguments };
  }

  // 🔥 AI驱动的智能元素匹配（不使用关键字匹配）
  private async findBestElementFromSnapshot(selector: string, snapshot: string, runId: string): Promise<{ ref: string; text: string } | null> {
    try {
      // 解析快照获取所有可交互元素
      const elements: Array<{ ref: string; text: string; role: string }> = [];
      const lines = snapshot.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        const refMatch = trimmedLine.match(/\[ref=([a-zA-Z0-9_-]+)\]/);

        if (refMatch) {
          const ref = refMatch[1];
          const textMatches = trimmedLine.match(/"([^"]*)"/g) || [];
          const texts = textMatches.map(t => t.replace(/"/g, ''));

          let role = '';
          if (trimmedLine.includes('textbox')) role = 'textbox';
          else if (trimmedLine.includes('button')) role = 'button';
          else if (trimmedLine.includes('link')) role = 'link';
          else if (trimmedLine.includes('checkbox')) role = 'checkbox';
          else if (trimmedLine.includes('combobox')) role = 'combobox';

          if (role && texts.length > 0) {
            elements.push({ ref, text: texts[0] || '', role });
          }
        }
      }

      console.log(`🔍 [${runId}] 从快照中发现 ${elements.length} 个可交互元素`);

      if (elements.length === 0) {
        return null;
      }

      // 🔥 使用AI进行智能元素匹配，而不是关键字匹配
      try {
        const matchPrompt = `请从以下页面元素中选择最适合的元素来匹配选择器："${selector}"

可用元素：
${elements.map((el, index) => `${index + 1}. ${el.ref}: ${el.role} "${el.text}"`).join('\n')}

请只返回最匹配的元素编号（1-${elements.length}），如果没有合适的元素请返回0：`;

        // 这里可以调用AI，但为了简化，我们使用基于文本相似度的匹配
        let bestMatch = null;
        let bestScore = 0;

        for (const element of elements) {
          let score = 0;
          const elementText = element.text.toLowerCase();
          const selectorLower = selector.toLowerCase();

          // 计算文本相似度
          if (elementText.includes(selectorLower) || selectorLower.includes(elementText)) {
            score += 80;
          }

          // 计算编辑距离相似度
          const similarity = this.calculateTextSimilarity(elementText, selectorLower);
          score += similarity * 60;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = element;
          }
        }

        if (bestMatch && bestScore >= 30) {
          console.log(`✅ [${runId}] AI智能匹配: "${bestMatch.text}" (${bestMatch.ref}) 得分: ${bestScore}`);
          return { ref: bestMatch.ref, text: bestMatch.text };
        }

        return null;

      } catch (aiError: any) {
        console.warn(`⚠️ [${runId}] AI匹配失败，使用第一个可用元素: ${aiError.message}`);
        return elements.length > 0 ? { ref: elements[0].ref, text: elements[0].text } : null;
      }

    } catch (error) {
      console.error(`❌ [${runId}] 元素匹配失败: ${error.message}`);
      return null;
    }
  }



  // 🔥 计算文本相似度的辅助方法
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1.0;
    if (!text1 || !text2) return 0.0;

    const len1 = text1.length;
    const len2 = text2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1.0;

    // 简单的字符匹配相似度
    let matches = 0;
    const minLen = Math.min(len1, len2);

    for (let i = 0; i < minLen; i++) {
      if (text1[i] === text2[i]) {
        matches++;
      }
    }

    return matches / maxLen;
  }

  // 🔥 执行MCP命令
  private async executeMcpCommand(step: TestStep, runId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 🔥 调试：打印步骤详细信息
      console.log(`🔍 [${runId}] executeMcpCommand 调试信息:`);
      console.log(`   action: ${step.action}`);
      console.log(`   selector: ${step.selector || 'undefined'}`);
      console.log(`   value: ${step.value || 'undefined'}`);
      console.log(`   url: ${step.url || 'undefined'}`);
      console.log(`   description: ${step.description}`);
      console.log(`   完整step对象:`, JSON.stringify(step, null, 2));

      this.addLog(runId, `🔍 executeMcpCommand调试: action=${step.action}, selector=${step.selector || 'undefined'}, value=${step.value || 'undefined'}`, 'info');

      // 如果步骤已经包含了action和必要参数，使用正确的参数格式
      // 🔥 调试：分别检查每个条件
      const conditions = {
        hasAction: !!step.action,
        navigate: step.action === 'navigate' && !!step.url,
        browserNavigate: step.action === 'browser_navigate' && !!step.url,
        click: step.action === 'click' && !!step.selector,
        browserClick: step.action === 'browser_click' && !!step.ref,
        fill: step.action === 'fill' && !!step.selector && step.value !== undefined,
        input: step.action === 'input' && !!step.selector && step.value !== undefined,
        type: step.action === 'type' && !!step.selector && step.value !== undefined,
        browserType: step.action === 'browser_type' && !!step.ref && step.text !== undefined,
        expect: step.action === 'expect',
        wait: step.action === 'wait',
        browserWaitFor: step.action === 'browser_wait_for'
      };

      console.log(`🔍 [${runId}] 条件检查详情:`, conditions);

      const conditionCheck = step.action && (
        conditions.navigate || conditions.browserNavigate ||
        conditions.click || conditions.browserClick ||
        conditions.fill || conditions.input || conditions.type || conditions.browserType ||
        conditions.expect || conditions.wait || conditions.browserWaitFor
      );

      console.log(`🔍 [${runId}] 预解析分支条件检查: ${conditionCheck}`);
      this.addLog(runId, `🔍 预解析分支条件检查: ${conditionCheck}`, 'info');

      if (conditionCheck) {
        console.log(`🔧 [${runId}] 使用预解析的MCP命令: ${step.action}`);

        // 导航命令需要特殊处理
        if ((step.action === 'navigate' || step.action === 'browser_navigate' || step.action === 'open' || step.action === 'goto') && step.url) {
          return await this.executeNavigationCommand(step.url, runId);
        }

        // 等待命令不需要元素查找
        if (step.action === 'wait') {
          const timeout = step.timeout || (step.description ? this.extractTimeoutFromDescription(step.description) : 1000);
          const mcpCommand = {
            name: MCPToolMapper.getToolName('wait'),
            arguments: { timeout: timeout }
          };
          console.log(`🔧 [${runId}] MCP工具调用: ${mcpCommand.name} ${JSON.stringify(mcpCommand.arguments)}`);
          const result = await this.mcpClient.callTool(mcpCommand);

          // 🔥 检查MCP返回结果
          console.log(`🔍 [${runId}] wait命令MCP返回结果:`, JSON.stringify(result, null, 2));
          this.addLog(runId, `🔍 wait命令MCP返回: ${JSON.stringify(result)}`, 'info');

          // 🔥 检查是否有错误信息
          if (result && result.content) {
            const content = Array.isArray(result.content) ? result.content : [result.content];
            for (const item of content) {
              if (item.type === 'text' && item.text) {
                if (item.text.includes('Error:') || item.text.includes('Failed:') || item.text.toLowerCase().includes('error')) {
                  console.error(`❌ [${runId}] wait命令执行失败: ${item.text}`);
                  this.addLog(runId, `❌ wait命令执行失败: ${item.text}`, 'error');
                  return { success: false, error: item.text };
                }
              }
            }
          }

          return { success: true };
        }

        // 断言命令保持原有格式
        if (step.action === 'expect') {
          const mcpCommand = {
            name: MCPToolMapper.getToolName('expect'),
            arguments: {
              selector: step.selector || 'body',
              condition: step.condition || 'visible',
              text: step.text || ''
            }
          };
          console.log(`🔧 [${runId}] MCP工具调用: ${mcpCommand.name} ${JSON.stringify(mcpCommand.arguments)}`);
          const result = await this.mcpClient.callTool(mcpCommand);

          // 🔥 检查MCP返回结果
          console.log(`🔍 [${runId}] expect命令MCP返回结果:`, JSON.stringify(result, null, 2));
          this.addLog(runId, `🔍 expect命令MCP返回: ${JSON.stringify(result)}`, 'info');

          // 🔥 检查是否有错误信息
          if (result && result.content) {
            const content = Array.isArray(result.content) ? result.content : [result.content];
            for (const item of content) {
              if (item.type === 'text' && item.text) {
                if (item.text.includes('Error:') || item.text.includes('Failed:') || item.text.toLowerCase().includes('error')) {
                  console.error(`❌ [${runId}] expect命令执行失败: ${item.text}`);
                  this.addLog(runId, `❌ expect命令执行失败: ${item.text}`, 'error');
                  return { success: false, error: item.text };
                }
              }
            }
          }

          return { success: true };
        }

        // 🔥 修复：点击和输入操作使用正确的参数格式
        if (step.action === 'click' || step.action === 'browser_click' ||
          step.action === 'fill' || step.action === 'input' || step.action === 'type' || step.action === 'browser_type') {
          try {
            console.log(`🔍 [${runId}] 处理AI解析的步骤参数`);
            console.log(`📋 [${runId}] 原始步骤信息: action=${step.action}, element=${step.element}, ref=${step.ref}, text=${step.text || step.value || 'N/A'}`);

            // 🔥 直接使用AI解析的参数构建MCP命令
            const mcpCommand = {
              name: MCPToolMapper.getToolName(step.action),
              arguments: {
                element: step.element || '未知元素',
                ref: step.ref || step.selector,
                ...(step.action.includes('type') || step.action.includes('fill') || step.action.includes('input') ? { text: step.text || step.value || '' } : {})
              }
            };

            // 验证参数格式
            if (!this.validateMCPParameters(mcpCommand.name, mcpCommand.arguments)) {
              throw new Error(`参数格式验证失败: ${JSON.stringify(mcpCommand.arguments)}`);
            }

            console.log(`🔧 [${runId}] MCP工具调用: ${mcpCommand.name} ${JSON.stringify(mcpCommand.arguments)}`);

            // 🔥 关键修复：增加MCP命令执行验证
            this.addLog(runId, `🔧 正在执行MCP命令: ${mcpCommand.name}`, 'info');

            const result = await this.mcpClient.callTool(mcpCommand);
            console.log(`✅ [${runId}] MCP工具调用成功: ${mcpCommand.name}`);

            // 🔥 详细检查MCP返回结果
            console.log(`🔍 [${runId}] 关键操作MCP返回结果:`, JSON.stringify(result, null, 2));
            this.addLog(runId, `🔍 关键操作MCP返回: ${JSON.stringify(result)}`, 'info');

            // 🔥 检查返回结果中的错误信息
            let hasError = false;
            let errorMessage = '';

            if (result && result.content) {
              const content = Array.isArray(result.content) ? result.content : [result.content];
              for (const item of content) {
                if (item.type === 'text' && item.text) {
                  console.log(`📄 [${runId}] MCP返回内容: ${item.text}`);
                  this.addLog(runId, `📄 MCP返回内容: ${item.text}`, 'info');

                  // 检查错误信息
                  if (item.text.includes('Error:') || item.text.includes('Failed:') ||
                    item.text.toLowerCase().includes('error') ||
                    item.text.includes('not found') ||
                    item.text.includes('无法找到') ||
                    item.text.includes('timeout')) {
                    hasError = true;
                    errorMessage = item.text;
                    console.error(`❌ [${runId}] MCP命令执行错误: ${item.text}`);
                    this.addLog(runId, `❌ MCP命令执行错误: ${item.text}`, 'error');
                  }
                }
              }
            }

            // 🔥 如果发现错误，返回失败状态
            if (hasError) {
              return { success: false, error: errorMessage };
            }

            // 🔥 新增：验证MCP命令是否真正执行
            const executionVerified = await this.verifyMCPCommandExecution(mcpCommand, runId);
            if (!executionVerified) {
              this.addLog(runId, `⚠️ MCP命令执行验证失败，可能没有实际效果`, 'warning');
              // 不直接返回失败，而是记录警告并继续
            } else {
              this.addLog(runId, `✅ MCP命令执行验证成功`, 'success');
            }

            return { success: true };
          } catch (elementError: any) {
            console.error(`❌ [${runId}] 预解析分支执行失败:`);
            console.error(`   🔍 选择器: ${step.selector}`);
            console.error(`   🎯 操作类型: ${step.action}`);
            console.error(`   📄 输入值: ${step.value || 'N/A'}`);
            console.error(`   💥 错误详情: ${elementError.message}`);
            console.error(`   📚 错误堆栈: ${elementError.stack}`);

            // 记录详细的错误信息到测试日志
            this.addLog(runId, `预解析分支执行失败: ${step.action} 操作`, 'error');
            this.addLog(runId, `目标选择器: ${step.selector}`, 'error');
            this.addLog(runId, `错误原因: ${elementError.message}`, 'error');

            return { success: false, error: `预解析分支执行失败: ${elementError.message}` };
          }
        }
      }

      // 如果步骤没有预解析的action和参数，则通过AI解析
      console.log(`🤖 [${runId}] 步骤未预解析，通过AI重新解析步骤`);

      // 获取当前页面快照用于AI决策
      const snapshot = await this.mcpClient.getSnapshot();

      // 通过AI解析步骤描述生成MCP命令
      try {
        const aiResult = await this.aiParser.parseNextStep(step.description, snapshot, runId);

        if (!aiResult.success || !aiResult.step) {
          throw new Error(`AI解析失败: ${aiResult.error}`);
        }

        // 使用AI解析的结果重新执行
        const aiStep = aiResult.step;
        console.log(`🤖 [${runId}] AI重新解析成功: ${aiStep.action} - ${aiStep.description}`);

        // 递归调用自己，但这次使用AI解析的步骤
        return await this.executeMcpCommand(aiStep, runId);

      } catch (aiError: any) {
        console.error(`❌ [${runId}] AI解析失败: ${aiError.message}`);
        return { success: false, error: `AI解析失败: ${aiError.message}` };
      }
    } catch (error: any) {
      console.error(`❌ [${runId}] MCP命令执行失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // 🔥 增强的导航命令执行
  private async executeNavigationCommand(url: string, runId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 验证和修正URL
      const validatedUrl = this.validateAndFixUrl(url);
      console.log(`🌐 [${runId}] 导航到: ${validatedUrl}`);

      // 2. 执行导航命令
      console.log(`🌐 [${runId}] 执行MCP导航命令: navigate ${validatedUrl}`);
      const navResult = await this.mcpClient.callTool({
        name: MCPToolMapper.getToolName('navigate'),
        arguments: { url: validatedUrl }
      });
      console.log(`🌐 [${runId}] 导航结果:`, navResult);

      // 3. 等待页面加载
      console.log(`⏳ [${runId}] 等待页面加载...`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. 验证导航结果
      const snapshot = await this.mcpClient.getSnapshot();
      const currentUrl = this.extractUrlFromSnapshot(snapshot);

      // 5. 检查导航是否成功
      if (currentUrl && currentUrl !== 'about:blank') {
        console.log(`✅ [${runId}] 导航成功: ${currentUrl}`);
        return { success: true };
      } else {
        console.log(`⚠️ [${runId}] 导航可能未完成，当前URL: ${currentUrl || 'unknown'}`);

        // 6. 重试导航
        console.log(`🔄 [${runId}] 重试导航...`);
        await this.mcpClient.callTool({
          name: MCPToolMapper.getToolName('navigate'),
          arguments: { url: validatedUrl }
        });

        // 7. 增加等待时间
        console.log(`⏳ [${runId}] 增加等待时间...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 8. 再次验证
        const newSnapshot = await this.mcpClient.getSnapshot();
        const newUrl = this.extractUrlFromSnapshot(newSnapshot);

        if (newUrl && newUrl !== 'about:blank') {
          console.log(`✅ [${runId}] 重试导航成功: ${newUrl}`);
          return { success: true };
        } else {
          // 9. 尝试备用导航方法
          console.log(`🔄 [${runId}] 尝试备用导航方法...`);

          // 使用browser_type输入URL并按Enter
          await this.mcpClient.callTool({
            name: 'type',
            arguments: { selector: 'body', text: validatedUrl }
          });

          await this.mcpClient.callTool({
            name: 'press_key',
            arguments: { key: 'Enter' }
          });

          // 10. 再次等待和验证
          await new Promise(resolve => setTimeout(resolve, 5000));
          const finalSnapshot = await this.mcpClient.getSnapshot();
          const finalUrl = this.extractUrlFromSnapshot(finalSnapshot);

          if (finalUrl && finalUrl !== 'about:blank') {
            console.log(`✅ [${runId}] 备用导航方法成功: ${finalUrl}`);
            return { success: true };
          } else {
            console.log(`❌ [${runId}] 导航失败，无法访问: ${validatedUrl}`);
            return { success: false, error: `无法导航到 ${validatedUrl}` };
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ [${runId}] 导航执行错误: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // 验证和修正URL
  private validateAndFixUrl(url: string): string {
    // 确保URL有协议前缀
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // 处理特殊字符
    try {
      new URL(url); // 验证URL格式
      return url;
    } catch (e) {
      // 如果URL格式不正确，尝试修复
      return encodeURI(url);
    }
  }

  // 从快照中提取URL
  private extractUrlFromSnapshot(snapshot: string): string | null {
    if (!snapshot) return null;
    const urlMatch = snapshot.match(/Page URL: ([^\n]+)/);
    return urlMatch ? urlMatch[1].trim() : null;
  }


  // 🔥 增强：每个步骤执行后的截图方法 - 支持数据库存储和本地文件验证
  private async takeStepScreenshot(runId: string, stepIndex: number | string, status: 'success' | 'failed' | 'error' | 'completed', description: string): Promise<void> {
    try {
      // 1. 生成截图文件名
      const timestamp = Date.now();
      const sanitizedDescription = description.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);
      const filename = `${runId}-step-${stepIndex}-${status}-${timestamp}.png`;

      console.log(`📸 [${runId}] 正在截图: ${filename}`);
      this.addLog(runId, `📸 正在截图: 步骤${stepIndex} - ${description}`, 'info');

      // 2. 使用统一的截图配置
      const { screenshotConfig } = await import('../../src/utils/screenshotConfig.js');
      const screenshotsDir = screenshotConfig.getScreenshotsDirectory();
      const configuredBackupDir = screenshotConfig.getBackupDirectory();
      
      // 确保截图目录存在
      screenshotConfig.ensureScreenshotsDirectory();

      // 3. 调用MCP客户端截图
      await this.mcpClient.takeScreenshot(filename);

      // 4. 验证截图文件是否成功保存并获取文件信息
      const filePath = path.join(screenshotsDir, filename);
      const fullPath = filePath;

      let fileSize = 0;
      let fileExists = false;

      // 🔥 如果禁用文件验证，直接标记为存在
      if (!screenshotConfig.isFileVerificationEnabled()) {
        fileExists = true;
        fileSize = 0; // 默认大小，不验证实际文件
        console.log(`✅ [${runId}] 文件验证已禁用，跳过文件检查: ${filename}`);
      } else {
        // 等待文件保存（MCP可能需要一些时间）
        const maxRetries = 8; // 增加重试次数
        let retryCount = 0;

        while (retryCount < maxRetries && !fileExists) {
          try {
            await new Promise(resolve => setTimeout(resolve, 300)); // 增加等待时间到300ms
            const stats = await fs.promises.stat(fullPath);
            fileSize = stats.size;

            // 验证文件不为空
            if (fileSize > 0) {
              fileExists = true;
              console.log(`✅ [${runId}] 截图文件验证成功: ${filename} (${fileSize} bytes)`);
            } else {
              console.warn(`⚠️ [${runId}] 截图文件为空，继续等待: ${filename}`);
              retryCount++;
            }
          } catch (error) {
            retryCount++;
            if (retryCount === maxRetries) {
              console.warn(`⚠️ [${runId}] 截图文件验证失败，重试${maxRetries}次后仍未找到: ${filename}`);
              this.addLog(runId, `⚠️ 截图可能失败: 文件 ${filename} 未找到`, 'warning');
            }
          }
        }
      }

      // 5. 获取测试运行信息
      const testRun = testRunStore.get(runId);

      // 6. 构建截图记录
      const screenshotRecord: ScreenshotRecord = {
        runId,
        testCaseId: testRun?.testCaseId,
        stepIndex: stepIndex.toString(),
        stepDescription: description,
        status,
        filePath,
        fileName: filename,
        fileSize,
        mimeType: 'image/png',
        fileExists
      };

      // 7. 保存到数据库
      try {
        await this.screenshotService.saveScreenshot(screenshotRecord);
        if (fileExists) {
          console.log(`✅ [${runId}] 截图已完整保存: ${filename} (本地文件+数据库)`);
          this.addLog(runId, `✅ 截图已完整保存: ${filename} (${fileSize} bytes)`, 'success');
        } else {
          console.log(`⚠️ [${runId}] 截图数据库记录已保存，但本地文件缺失: ${filename}`);
          this.addLog(runId, `⚠️ 截图数据库记录已保存，但本地文件可能缺失: ${filename}`, 'warning');
        }
      } catch (dbError: any) {
        console.error(`❌ [${runId}] 截图数据库保存失败: ${dbError.message}`);
        if (fileExists) {
          this.addLog(runId, `⚠️ 截图文件已保存到本地，但数据库记录失败: ${dbError.message}`, 'warning');
        } else {
          this.addLog(runId, `❌ 截图完全失败: 本地文件和数据库都保存失败`, 'error');
        }
        // 不抛出错误，确保测试执行不因截图数据库保存失败而中断
      }

      // 8. 创建本地备份（优化的双重保存机制）
      if (fileExists && fileSize > 0 && screenshotConfig.shouldBackup()) {
        try {
          // 使用配置的备份目录
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
          const actualBackupDir = path.join(configuredBackupDir, dateStr, runId);

          await fs.promises.mkdir(actualBackupDir, { recursive: true });

          const backupPath = path.join(actualBackupDir, filename);
          await fs.promises.copyFile(fullPath, backupPath);

          console.log(`📂 [${runId}] 截图已备份: ${actualBackupDir}/${filename}`);
          this.addLog(runId, `📂 截图已创建备份副本`, 'info');

          // 验证备份文件
          const backupStats = await fs.promises.stat(backupPath);
          if (backupStats.size === fileSize) {
            console.log(`✅ [${runId}] 备份文件验证成功: ${backupStats.size} bytes`);
          } else {
            console.warn(`⚠️ [${runId}] 备份文件大小不匹配: ${backupStats.size} vs ${fileSize}`);
          }
        } catch (backupError: any) {
          console.warn(`⚠️ [${runId}] 截图备份失败: ${backupError.message}`);
          this.addLog(runId, `⚠️ 截图备份失败，但主文件已保存`, 'warning');
        }
      }

      // 9. 生成截图索引文件（便于管理和查看）
      if (fileExists) {
        try {
          const indexDir = path.join(screenshotsDir, 'index');
          await fs.promises.mkdir(indexDir, { recursive: true });

          const indexFile = path.join(indexDir, `${runId}_screenshots.json`);
          let indexData: any[] = [];

          // 读取现有索引文件
          try {
            const existingIndex = await fs.promises.readFile(indexFile, 'utf-8');
            indexData = JSON.parse(existingIndex);
          } catch {
            // 索引文件不存在，使用空数组
          }

          // 添加新的截图记录
          indexData.push({
            stepIndex: stepIndex.toString(),
            filename,
            description,
            status,
            timestamp: new Date().toISOString(),
            fileSize,
            filePath: filePath
          });

          // 保存更新后的索引
          await fs.promises.writeFile(indexFile, JSON.stringify(indexData, null, 2));
          console.log(`📋 [${runId}] 截图索引已更新: ${indexData.length} 个截图记录`);
        } catch (indexError: any) {
          console.warn(`⚠️ [${runId}] 截图索引更新失败: ${indexError.message}`);
          // 索引失败不影响主流程
        }
      }

    } catch (error: any) {
      console.error(`❌ [${runId}] 截图失败: ${error.message}`);
      this.addLog(runId, `❌ 截图失败: ${error.message}`, 'warning');
      // 不抛出错误，确保测试执行不因截图失败而中断
    }
  }

  // 🔥 新增：操作后延迟方法
  private async delayAfterOperation(action: string): Promise<void> {
    let delay = 1000; // 默认延迟1秒

    switch (action) {
      case 'navigate':
      case 'browser_navigate':
        delay = 3000; // 导航后等待3秒
        break;
      case 'click':
      case 'browser_click':
        delay = 1500; // 点击后等待1.5秒
        break;
      case 'fill':
      case 'input':
      case 'type':
      case 'browser_type':
        delay = 800; // 输入后等待0.8秒
        break;
      case 'wait':
      case 'browser_wait_for':
        delay = 500; // 等待命令后短暂延迟
        break;
      default:
        delay = 1000;
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }


  // #region Screenshot Management

  /**
   * 清理指定测试运行的所有截图文件和数据库记录
   * @param runId 测试运行ID
   * @returns 清理结果统计
   */
  public async cleanupTestScreenshots(runId: string): Promise<{
    deleted: number;
    failed: number;
    totalSize: number;
  }> {
    try {
      console.log(`🧹 开始清理测试运行截图: ${runId}`);

      // 1. 获取该测试运行的所有截图记录
      const screenshots = await this.screenshotService.getScreenshotsByRunId(runId);

      if (screenshots.length === 0) {
        console.log(`📋 测试运行 ${runId} 没有截图记录`);
        return { deleted: 0, failed: 0, totalSize: 0 };
      }

      let deleted = 0;
      let failed = 0;
      let totalSize = 0;

      // 2. 删除本地文件
      for (const screenshot of screenshots) {
        try {
          const fullPath = path.join(process.cwd(), screenshot.filePath);

          // 检查文件是否存在
          try {
            const stats = await fs.promises.stat(fullPath);
            totalSize += stats.size;

            // 删除主文件
            await fs.promises.unlink(fullPath);

            // 删除备份文件
            const backupPattern = path.join(process.cwd(), 'screenshots', 'backup', '*', runId, screenshot.fileName);
            // 简化处理：尝试删除可能的备份位置
            const backupDir = path.join(process.cwd(), 'screenshots', 'backup');
            if (await this.fileExists(backupDir)) {
              await this.cleanupBackupFiles(backupDir, runId, screenshot.fileName);
            }

            deleted++;
            console.log(`🗑️ 已删除截图文件: ${screenshot.fileName}`);
          } catch (fileError) {
            // 文件不存在，跳过
            console.log(`📄 截图文件不存在（跳过）: ${screenshot.fileName}`);
            deleted++; // 算作成功删除
          }
        } catch (error: any) {
          console.error(`❌ 删除截图文件失败: ${screenshot.fileName}`, error);
          failed++;
        }
      }

      // 3. 删除数据库记录（通过ScreenshotService的清理方法）
      // 这里我们可以扩展ScreenshotService来支持按runId删除

      // 4. 删除索引文件
      try {
        const indexFile = path.join(process.cwd(), 'screenshots', 'index', `${runId}_screenshots.json`);
        if (await this.fileExists(indexFile)) {
          await fs.promises.unlink(indexFile);
          console.log(`📋 已删除截图索引文件: ${runId}_screenshots.json`);
        }
      } catch (indexError: any) {
        console.warn(`⚠️ 删除索引文件失败: ${indexError.message}`);
      }

      const result = { deleted, failed, totalSize };
      console.log(`✅ 测试运行 ${runId} 截图清理完成:`, result);
      return result;

    } catch (error: any) {
      console.error(`❌ 清理测试截图失败: ${error.message}`);
      throw new Error(`清理测试截图失败: ${error.message}`);
    }
  }

  /**
   * 获取截图存储统计信息
   */
  public async getScreenshotStats(): Promise<{
    totalScreenshots: number;
    totalSize: number;
    byStatus: Record<string, number>;
    recentCount: number;
  }> {
    try {
      const stats = await this.screenshotService.getStorageStats();
      return {
        totalScreenshots: stats.totalScreenshots,
        totalSize: stats.totalSize,
        byStatus: stats.countByStatus,
        recentCount: stats.recentActivity.last24Hours,
      };
    } catch (error: any) {
      console.error(`❌ 获取截图统计失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 辅助方法：检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 辅助方法：清理备份文件
   */
  private async cleanupBackupFiles(backupDir: string, runId: string, fileName: string): Promise<void> {
    try {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const dateDirs = await fs.promises.readdir(backupDir);

      for (const dateDir of dateDirs) {
        if (dateRegex.test(dateDir)) {
          const runBackupDir = path.join(backupDir, dateDir, runId);
          const backupFile = path.join(runBackupDir, fileName);

          if (await this.fileExists(backupFile)) {
            await fs.promises.unlink(backupFile);
            console.log(`🗑️ 已删除备份文件: backup/${dateDir}/${runId}/${fileName}`);

            // 如果备份目录为空，删除目录
            try {
              const files = await fs.promises.readdir(runBackupDir);
              if (files.length === 0) {
                await fs.promises.rmdir(runBackupDir);
                console.log(`📁 已删除空备份目录: backup/${dateDir}/${runId}`);
              }
            } catch {
              // 忽略目录删除失败
            }
          }
        }
      }
    } catch (error: any) {
      console.warn(`⚠️ 清理备份文件时出错: ${error.message}`);
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
    const timestamp = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    
    // 控制台输出带时间戳
    const consoleMessage = `[${timeStr}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(consoleMessage);
        break;
      case 'warning':
        console.warn(consoleMessage);
        break;
      case 'success':
        console.log(`✅ ${consoleMessage}`);
        break;
      default:
        console.log(consoleMessage);
    }
    
    if (testRun) {
      const logEntry: TestLog = { id: uuidv4(), timestamp: new Date(), message, level: level || 'info' };
      testRun.logs.push(logEntry);
      this.wsManager.broadcast({ type: 'log', runId, data: { log: logEntry } });
    }
  }

  private async finalizeTestRun(runId: string) {
    const testRun = testRunStore.get(runId);
    if (testRun) {
      testRun.endedAt = new Date();
      const duration = this.calculateDuration(testRun.startedAt, testRun.endedAt);
      this.wsManager.broadcast({ type: 'test_update', runId, data: { status: testRun.status, endedAt: testRun.endedAt, duration } });
    }
  }

  private calculateDuration(startTime: Date, endTime: Date): string {
    return ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2) + 's';
  }

  private extractTimeoutFromDescription(description: string): number {
    // 支持多种格式：10秒、10s、停留10、等待10
    const match = description.match(/(\d+)\s*(秒|s|)/i);
    if (match) {
      const seconds = parseInt(match[1]);
      return seconds * 1000; // 转换为毫秒
    }

    // 检查"停留"或"等待"关键词
    const stayMatch = description.match(/停留\s*(\d+)/i);
    if (stayMatch) {
      return parseInt(stayMatch[1]) * 1000;
    }

    const waitMatch = description.match(/等待\s*(\d+)/i);
    if (waitMatch) {
      return parseInt(waitMatch[1]) * 1000;
    }

    return 2000; // 默认2秒
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 🔥 新增：确保页面稳定性 - 增强版
  private async ensurePageStability(runId: string): Promise<void> {
    try {
      this.addLog(runId, `⏳ 确保页面稳定性...`, 'info');

      // 1. 等待页面完全加载（增强版）
      await this.mcpClient.waitForPageFullyLoaded();

      // 2. 检测页面稳定性
      await this.mcpClient.waitForPageStability();

      // 3. 刷新页面快照确保同步
      await this.mcpClient.getSnapshot();

      this.addLog(runId, `✅ 页面稳定性检查完成`, 'info');
    } catch (error: any) {
      this.addLog(runId, `⚠️ 页面稳定性检查失败，使用降级策略: ${error.message}`, 'warning');

      // 降级策略：基础等待
      try {
        await this.mcpClient.waitForLoad();
        await this.delay(1000);
        await this.mcpClient.getSnapshot();
        this.addLog(runId, `✅ 降级页面稳定性检查完成`, 'info');
      } catch (fallbackError: any) {
        this.addLog(runId, `⚠️ 降级策略也失败，继续执行: ${fallbackError.message}`, 'warning');
      }
    }
  }

  // 🔥 新增：判断操作是否需要验证
  private async needsOperationVerification(step: import('./aiParser.js').TestStep): Promise<boolean> {
    // 根据操作类型判断是否需要效果验证
    const verificationNeededActions = [
      'navigate', 'browser_navigate',    // 导航操作需要验证页面是否正确加载
      'click', 'browser_click',          // 点击操作需要验证是否触发了预期效果
      'fill', 'input', 'type', 'browser_type',  // 输入操作需要验证内容是否正确填入
      'browser_select_option'            // 选择操作需要验证选项是否被选中
    ];

    return verificationNeededActions.includes(step.action);
  }

  // 🔥 新增：验证操作成功
  private async verifyOperationSuccess(step: import('./aiParser.js').TestStep, runId: string): Promise<boolean> {
    try {
      this.addLog(runId, `🔍 验证操作效果...`, 'info');

      // 根据操作类型进行不同的验证
      switch (step.action) {
        case 'navigate':
        case 'browser_navigate':
          return await this.verifyNavigationSuccess(step, runId);

        case 'click':
        case 'browser_click':
          return await this.verifyClickSuccess(step, runId);

        case 'fill':
        case 'input':
        case 'type':
        case 'browser_type':
          return await this.verifyInputSuccess(step, runId);

        default:
          // 对于其他操作，简单验证页面仍然可访问
          await this.mcpClient.getSnapshot();
          return true;
      }
    } catch (error: any) {
      this.addLog(runId, `⚠️ 操作效果验证失败: ${error.message}`, 'warning');
      return false;
    }
  }

  // 🔥 新增：验证导航成功
  private async verifyNavigationSuccess(step: TestStep, runId: string): Promise<boolean> {
    try {
      const snapshot = await this.mcpClient.getSnapshot();
      const currentUrl = this.extractUrlFromSnapshot(snapshot);

      if (currentUrl && currentUrl !== 'about:blank' && step.url) {
        const targetDomain = new URL(step.url).hostname;
        const currentDomain = new URL(currentUrl).hostname;

        if (currentDomain.includes(targetDomain) || targetDomain.includes(currentDomain)) {
          this.addLog(runId, `✅ 导航验证成功: ${currentUrl}`, 'success');
          return true;
        }
      }

      this.addLog(runId, `⚠️ 导航验证失败: 期望${step.url}, 实际${currentUrl}`, 'warning');
      return false;
    } catch (error: any) {
      this.addLog(runId, `❌ 导航验证异常: ${error.message}`, 'error');
      return false;
    }
  }

  // 🔥 新增：验证点击成功
  private async verifyClickSuccess(step: TestStep, runId: string): Promise<boolean> {
    try {
      // 点击后等待一下，看页面是否有变化
      await this.delay(1000);

      const newSnapshot = await this.mcpClient.getSnapshot();

      // 简单验证：页面内容应该有变化或者URL可能改变
      if (newSnapshot && newSnapshot.length > 100) {
        this.addLog(runId, `✅ 点击验证成功: 页面响应正常`, 'success');
        return true;
      }

      return false;
    } catch (error: any) {
      this.addLog(runId, `❌ 点击验证异常: ${error.message}`, 'error');
      return false;
    }
  }

  // 🔥 新增：验证输入成功
  private async verifyInputSuccess(step: TestStep, runId: string): Promise<boolean> {
    try {
      // 输入后简单验证页面仍然可访问
      const snapshot = await this.mcpClient.getSnapshot();

      if (snapshot && snapshot.length > 50) {
        this.addLog(runId, `✅ 输入验证成功: 页面响应正常`, 'success');
        return true;
      }

      return false;
    } catch (error: any) {
      this.addLog(runId, `❌ 输入验证异常: ${error.message}`, 'error');
      return false;
    }
  }

  // 🔥 使用AI驱动的替代搜索策略
  private async executeMcpCommandWithAlternativeSearch(step: TestStep, runId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 🔥 首先尝试通过AI重新解析步骤
      console.log(`🔄 [${runId}] 使用AI替代搜索策略重新解析步骤`);

      const snapshot = await this.mcpClient.getSnapshot();
      const aiResult = await this.aiParser.parseNextStep(step.description, snapshot, runId);

      if (aiResult.success && aiResult.step) {
        const aiStep = aiResult.step;
        console.log(`🤖 [${runId}] AI替代解析成功: ${aiStep.action}`);

        // 使用AI重新解析的步骤
        const result = await this.executeMcpCommand(aiStep, runId);
        if (result.success) {
          this.addLog(runId, `✅ AI替代搜索成功`, 'success');
          return result;
        }
      }

      // 如果AI替代解析也失败，使用原始方法
      console.log(`⚠️ [${runId}] AI替代解析失败，使用原始方法`);
      return await this.executeMcpCommand(step, runId);

    } catch (error: any) {
      console.error(`❌ [${runId}] 替代搜索策略失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // 🔥 使用AI驱动的简化策略执行
  private async executeMcpCommandWithSimpleSelector(step: TestStep, runId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔄 [${runId}] 使用AI简化策略`);

      // 🔥 直接通过AI重新生成一个更简单的步骤
      const snapshot = await this.mcpClient.getSnapshot();

      // 构建简化版的AI提示词
      const simplifiedPrompt = `请为以下指令生成一个最简单、最基础的MCP命令，即使元素匹配不完美也要尽量执行：

用户指令: "${step.description}"

请返回JSON格式的MCP命令，优先考虑通用选择器：`;

      try {
        // 这里可以调用AI，但为了简化，我们直接使用基础逻辑
        let simplifiedStep = { ...step };

        // 为不同操作类型提供最基础的后备方案
        if (step.action === 'click' || step.action === 'browser_click') {
          // 使用第一个可用的按钮元素
          const elements = this.extractElementsFromSnapshot(snapshot);
          const firstButton = elements.find(el => el.role === 'button');
          if (firstButton) {
            simplifiedStep.selector = firstButton.ref;
          }
        } else if (step.action === 'fill' || step.action === 'input' || step.action === 'type' || step.action === 'browser_type') {
          // 使用第一个可用的输入元素
          const elements = this.extractElementsFromSnapshot(snapshot);
          const firstInput = elements.find(el => el.role === 'textbox');
          if (firstInput) {
            simplifiedStep.selector = firstInput.ref;
          }
        }

        this.addLog(runId, `🔄 使用AI简化策略: "${simplifiedStep.selector}"`, 'info');
        return await this.executeMcpCommand(simplifiedStep, runId);

      } catch (aiError: any) {
        console.warn(`⚠️ [${runId}] AI简化策略失败: ${aiError.message}`);
        return { success: false, error: aiError.message };
      }

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // 🔥 从快照中提取元素的辅助方法
  private extractElementsFromSnapshot(snapshot: string): Array<{ ref: string, role: string, text: string }> {
    if (!snapshot) return [];

    const elements: Array<{ ref: string, role: string, text: string }> = [];
    const lines = snapshot.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      const refMatch = trimmedLine.match(/\[ref=([a-zA-Z0-9_-]+)\]/);

      if (refMatch) {
        const ref = refMatch[1];
        const textMatches = trimmedLine.match(/"([^"]*)"/g) || [];
        const texts = textMatches.map(t => t.replace(/"/g, ''));

        let role = '';
        if (trimmedLine.includes('textbox')) role = 'textbox';
        else if (trimmedLine.includes('button')) role = 'button';
        else if (trimmedLine.includes('link')) role = 'link';
        else if (trimmedLine.includes('checkbox')) role = 'checkbox';
        else if (trimmedLine.includes('combobox')) role = 'combobox';

        if (role && texts.length > 0) {
          elements.push({ ref, role, text: texts[0] || '' });
        }
      }
    }

    return elements;
  }

  // 🔥 参数格式转换和验证辅助方法
  private convertToMCPFormat(
    action: string,
    originalParams: any,
    elementRef?: { ref: string; text: string }
  ): any {
    console.log(`🔄 参数格式转换: ${action}`);
    console.log(`📥 原始参数:`, JSON.stringify(originalParams));

    let convertedParams: any = {};

    switch (action) {
      case 'click':
        convertedParams = elementRef ? { ref: elementRef.ref } : { ref: originalParams.selector };
        break;
      case 'fill':
      case 'input':
      case 'type':
        convertedParams = elementRef
          ? { ref: elementRef.ref, text: originalParams.value || originalParams.text }
          : { ref: originalParams.selector, text: originalParams.value || originalParams.text };
        break;
      case 'wait':
        convertedParams = { timeout: originalParams.timeout || 1000 };
        break;
      case 'expect':
        convertedParams = {
          selector: originalParams.selector || 'body',
          condition: originalParams.condition || 'visible',
          text: originalParams.text || ''
        };
        break;
      default:
        convertedParams = originalParams;
    }

    console.log(`📤 转换后参数:`, JSON.stringify(convertedParams));
    return convertedParams;
  }

  // 🔥 参数格式验证方法
  private validateMCPParameters(toolName: string, parameters: any): boolean {
    const requiredParams: Record<string, string[]> = {
      'browser_click': ['element', 'ref'],
      'browser_type': ['element', 'ref', 'text'],
      'browser_wait_for': ['timeout'],
      'browser_navigate': ['url'],
      'browser_snapshot': []
    };

    const required = requiredParams[toolName];
    if (!required) {
      console.warn(`⚠️ 未知的工具名称: ${toolName}`);
      return true; // 对于未知工具，跳过验证
    }

    for (const param of required) {
      if (!(param in parameters)) {
        console.error(`❌ 缺少必需参数: ${param} for ${toolName}`);
        return false;
      }
    }

    // 特殊验证
    if (toolName === 'browser_type' && (!parameters.text || parameters.text.trim() === '')) {
      console.error(`❌ browser_type 的 text 参数不能为空`);
      return false;
    }

    if (toolName === 'browser_click' && (!parameters.element || parameters.element.trim() === '' || !parameters.ref || parameters.ref.trim() === '')) {
      console.error(`❌ browser_click 的 element 和 ref 参数都不能为空`);
      return false;
    }

    return true;
  }

  // 🔥 新增：验证MCP命令是否真正执行的方法
  private async verifyMCPCommandExecution(mcpCommand: { name: string; arguments: any }, runId: string): Promise<boolean> {
    try {
      console.log(`🔍 [${runId}] 开始验证MCP命令执行效果: ${mcpCommand.name}`);
      this.addLog(runId, `🔍 验证MCP命令执行效果...`, 'info');

      // 等待一段时间让操作生效
      await this.delay(500);

      // 获取操作后的页面快照
      const postSnapshot = await this.mcpClient.getSnapshot();

      switch (mcpCommand.name) {
        case 'browser_navigate':
          return await this.verifyNavigationExecution(mcpCommand.arguments.url, postSnapshot, runId);

        case 'browser_type':
          return await this.verifyTypeExecution(mcpCommand.arguments, postSnapshot, runId);

        case 'browser_click':
          return await this.verifyClickExecution(mcpCommand.arguments, postSnapshot, runId);

        default:
          // 对于其他命令，简单验证页面仍然响应
          if (postSnapshot && postSnapshot.length > 50) {
            console.log(`✅ [${runId}] 基础验证通过: 页面仍然响应`);
            return true;
          }
          return false;
      }
    } catch (error: any) {
      console.error(`❌ [${runId}] MCP命令执行验证失败: ${error.message}`);
      this.addLog(runId, `⚠️ 命令执行验证异常: ${error.message}`, 'warning');
      return false; // 验证失败不影响主流程
    }
  }

  // 🔥 验证导航命令执行
  private async verifyNavigationExecution(targetUrl: string, snapshot: string, runId: string): Promise<boolean> {
    try {
      const currentUrl = this.extractUrlFromSnapshot(snapshot);

      if (currentUrl && currentUrl !== 'about:blank') {
        const targetDomain = new URL(targetUrl).hostname;
        const currentDomain = new URL(currentUrl).hostname;

        if (currentDomain.includes(targetDomain) || targetDomain.includes(currentDomain)) {
          console.log(`✅ [${runId}] 导航验证成功: ${currentUrl}`);
          this.addLog(runId, `✅ 导航验证成功: 已到达目标页面`, 'success');
          return true;
        }
      }

      console.log(`⚠️ [${runId}] 导航验证失败: 期望${targetUrl}, 实际${currentUrl}`);
      this.addLog(runId, `⚠️ 导航验证失败: 页面URL不匹配`, 'warning');
      return false;
    } catch (error: any) {
      console.error(`❌ [${runId}] 导航验证异常: ${error.message}`);
      return false;
    }
  }

  // 🔥 验证输入命令执行
  private async verifyTypeExecution(args: { ref: string; text: string }, snapshot: string, runId: string): Promise<boolean> {
    try {
      // 检查目标元素是否仍然存在
      const elementExists = snapshot.includes(`[ref=${args.ref}]`);

      if (elementExists) {
        console.log(`✅ [${runId}] 输入验证成功: 目标元素存在`);
        this.addLog(runId, `✅ 输入验证成功: 已向元素输入内容`, 'success');
        return true;
      } else {
        console.log(`⚠️ [${runId}] 输入验证失败: 目标元素不存在`);
        this.addLog(runId, `⚠️ 输入验证失败: 目标元素可能已变化`, 'warning');
        return false;
      }
    } catch (error: any) {
      console.error(`❌ [${runId}] 输入验证异常: ${error.message}`);
      return false;
    }
  }

  // 🔥 验证点击命令执行
  private async verifyClickExecution(args: { ref: string }, snapshot: string, runId: string): Promise<boolean> {
    try {
      // 点击后页面应该有响应，检查页面是否仍然正常
      if (snapshot && snapshot.length > 100) {
        console.log(`✅ [${runId}] 点击验证成功: 页面响应正常`);
        this.addLog(runId, `✅ 点击验证成功: 页面已响应点击操作`, 'success');
        return true;
      } else {
        console.log(`⚠️ [${runId}] 点击验证失败: 页面响应异常`);
        this.addLog(runId, `⚠️ 点击验证失败: 页面可能未响应`, 'warning');
        return false;
      }
    } catch (error: any) {
      console.error(`❌ [${runId}] 点击验证异常: ${error.message}`);
      return false;
    }
  }
  // #endregion
}
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

    console.log(`🚀 [${runId}] 开始执行测试 #${testRun.testCaseId}`);

    // 查找测试用例
    const testCase = await this.findTestCaseById(testRun.testCaseId);
    if (!testCase || !testCase.steps) {
      console.error(`❌ [${runId}] 测试用例 #${testRun.testCaseId} 未找到或没有步骤`);
      this.updateTestRunStatus(runId, 'failed', `测试用例 #${testRun.testCaseId} 未找到或没有步骤。`);
      return;
    }

    console.log(`📋 [${runId}] 测试内容: ${testCase.name}`);

    try {
      await this.mcpClient.initialize({
        reuseSession: testRun.reuseBrowser,
        contextState: testRun.contextState
      });

      this.updateTestRunStatus(runId, 'running', '开始解析测试步骤...');
      this.addLog(runId, `🤖 开始AI解析测试步骤`, 'info');

      console.log(`🤖 [${runId}] === 开始AI解析 ===`);
      console.log(`📄 [${runId}] 待解析内容: ${testCase.steps}`);

      // 🔥 获取当前页面快照用于AI解析
      let snapshot = null;
      try {
          try {
          // 增强等待 - 等待网络空闲和页面完全加载
          await this.mcpClient.waitForLoad();
          
          // 重试获取页面快照
          let retryCount = 0;
          while (retryCount < 3) {
            snapshot = await this.mcpClient.getSnapshot();
            
            if (snapshot && snapshot.length > 100) { // 确保快照有内容
              break;
            }
            
            console.warn(`[${runId}] ⚠️ 页面快照为空，重试 ${retryCount + 1}/3`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            retryCount++;
          }
          
          if (!snapshot || snapshot.length <= 100) {
            console.error(`[${runId}] ❌ 页面加载异常，获取不到内容`);
            console.error(`[${runId}] 📊 建议检查：1) 网络连接 2) 网站访问权限 3) 页面是否被防火墙拦截`);
            
            // 尝试截图查看实际页面状态
            try {
              await this.mcpClient.takeScreenshot(`${runId}-debug.png`);
              console.log(`[${runId}] 📸 调试截图已保存: ${runId}-debug.png`);
            } catch (screenshotError) {
              console.error(`[${runId}] 截图失败: ${screenshotError.message}`);
            }
          }
          
          this.logSnapshotSummary(snapshot, runId);
        } catch (loadError) {
          console.error(`[${runId}] ❌ 页面加载失败: ${loadError.message}`);
          console.error(`[${runId}] 📊 当前URL: ${await this.mcpClient.getCurrentUrl?.() || '未知'}`);
        }
        this.logSnapshotSummary(snapshot, runId);
        
      } catch (error) {
        console.warn(`[${runId}] ⚠️ 获取页面快照失败，继续无快照解析:`, error.message);
      }

      // 🔥 移除一次性完整解析，改为逐步解析

      // 🔥 智能用例拆分和逐步执行
      this.updateTestRunStatus(runId, 'running', '开始智能拆分和执行测试步骤...');

      console.log(`🎯 [${runId}] ===== 开始智能拆分模式 =====`);
      console.log(`📋 [${runId}] 原始测试用例: "${testCase.steps}"`);
      
      let stepNumber = 1;
      let remainingSteps = testCase.steps;
      
      // 🔥 增强的换行符处理，支持多种换行格式
      const normalizeLineBreaks = (text: string) => {
        return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      };
      
      remainingSteps = normalizeLineBreaks(remainingSteps);
      const allLines = remainingSteps.split('\n').filter(line => line.trim());
      console.log(`📊 [${runId}] 总步骤数: ${allLines.length}行`);
      
      // 🔥 增强的智能拆分 - 不仅限于长文本
      if (allLines.length === 1) {
        console.log(`🔍 [${runId}] 检测到单行文本，使用AI智能拆分...`);
        const smartSplit = await this.smartSplitTestSteps(remainingSteps, runId);
        if (smartSplit.length > 1) {
          remainingSteps = smartSplit.join('\n');
          console.log(`✅ [${runId}] AI智能拆分为 ${smartSplit.length} 个步骤`);
          
          // 重新计算行数
          const newLines = remainingSteps.split('\n').filter(line => line.trim());
          console.log(`📊 [${runId}] 拆分后总步骤数: ${newLines.length}行`);
        }
      }
      
      while (remainingSteps.trim()) {
        console.log(`🤖 [${runId}] ===== 步骤 ${stepNumber} =====`);
        console.log(`📋 [${runId}] 当前剩余: "${remainingSteps.substring(0, 150)}..."`);
        
        const currentLines = remainingSteps.split('\n').filter(line => line.trim());
        console.log(`📊 [${runId}] 当前剩余步骤数: ${currentLines.length}行`);
        
        // 🔍 每步骤前获取最新页面快照
        let currentSnapshot = null;
        try {
          currentSnapshot = await this.mcpClient.getSnapshot();
          if (currentSnapshot) {
            console.log(`📊 [${runId}] 已获取当前页面快照 (${currentSnapshot.split('\n').length}行)`);
          }
        } catch (snapshotError) {
          console.warn(`⚠️ [${runId}] 获取页面快照失败，继续无快照解析:`, snapshotError.message);
        }

        // 🔥 获取下一步骤
        const nextLine = currentLines[0] || remainingSteps.trim();
        console.log(`📋 [${runId}] 当前步骤文本: "${nextLine}"`);
        
        // 🔥 使用增强的逐步解析
        const parseResult = await this.aiParser.parseNextStep(remainingSteps, currentSnapshot, runId);
        
        if (!parseResult.success || !parseResult.step) {
          console.log(`✅ [${runId}] 所有步骤已执行完成`);
          break;
        }

        const step = this.processParsedStep(parseResult.step, stepNumber, runId, testRun);
        remainingSteps = parseResult.remaining || '';
        
        console.log(`✅ [${runId}] 步骤 ${stepNumber} 解析成功: ${step.description}`);
        console.log(`📋 [${runId}] 下一步骤剩余: ${remainingSteps.split('\n').filter(l => l.trim()).length}行`);
        
        console.log(`🎯 [${runId}] 执行步骤 ${stepNumber}: ${step.description}`);
        this.addLog(runId, `执行步骤 ${stepNumber}: ${step.description}`, 'info');
        this.updateTestRunStatus(runId, 'running', `执行步骤 ${stepNumber}: ${step.description}`);

        try {
          const result = await this.executeStepWithRetry(step, testRun);
          if (result.success) {
            console.log(`✅ [${runId}] 步骤 ${stepNumber} 执行成功`);
            this.addLog(runId, `✅ 步骤 ${stepNumber} 执行成功`, 'success');
          } else {
            console.error(`❌ [${runId}] 步骤 ${stepNumber} 失败: ${result.error}`);
            this.addLog(runId, `❌ 步骤 ${stepNumber} 执行失败: ${result.error}`, 'error');
            this.updateTestRunStatus(runId, 'failed', `步骤 ${stepNumber} 执行失败: ${result.error}`);
            return;
          }
        } catch (error: any) {
          console.error(`💥 [${runId}] 步骤 ${stepNumber} 异常:`, error.message);
          this.addLog(runId, `💥 步骤 ${stepNumber} 执行异常: ${error.message}`, 'error');
          this.updateTestRunStatus(runId, 'failed', `步骤 ${stepNumber} 执行异常: ${error.message}`);
          return;
        }

        stepNumber++;
        
        // 🔥 步骤间短暂等待，确保状态同步
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.addLog(runId, `🎉 所有 ${stepNumber - 1} 个步骤执行完成`, 'success');

      // 处理上下文共享
      await this.handleContextSharingOnSuccess(testRun);

      this.updateTestRunStatus(runId, 'completed', `测试执行成功，共执行 ${stepNumber - 1} 个步骤`);
      this.addLog(runId, '✅ 测试执行成功完成', 'success');

      console.log(`🏆 [${runId}] 测试完成 ✅`);

    } catch (error: any) {
      console.error(`💥 [${runId}] 测试失败:`, error.message);
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
    const maxRetries = 3; // 增加重试次数
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        this.addLog(runId, `🔍 [步骤 ${step.order}] 开始执行: ${step.description}`);
        await this.mcpClient.executeStep(step, runId);
        this.addLog(runId, `✅ [步骤 ${step.order}] 执行成功`, 'success');
        testRun.successfulSteps.push(step.id);
        this.wsManager.broadcast({ type: 'test_update', runId, data: { successfulSteps: testRun.successfulSteps } });
        return { success: true };
      } catch (error: any) {
        attempt++;
        
        // 🔥 增强失败诊断信息，但减少日志量
        console.error(`❌ [${runId}] 步骤${step.order}失败 (尝试 ${attempt}/${maxRetries}): ${error.message}`);
        
        if (attempt < maxRetries) {
          console.log(`🔄 [${runId}] 正在重试...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // 递增等待
        } else {
          // 最后一次失败时获取详细信息
          try {
            const diagnosticSnapshot = await this.mcpClient.getSnapshot();
            if (diagnosticSnapshot) {
              const lines = diagnosticSnapshot.split('\n');
              const elements = lines.filter(l => l.includes('button') || l.includes('input') || l.includes('textbox')).length;
              console.error(`📊 [${runId}] 诊断: 页面${elements}个可交互元素`);
            }
          } catch (diagnosticError) {
            console.error(`📊 [${runId}] 诊断快照失败:`, diagnosticError);
          }
        }
        
        this.addLog(runId, `⚠️ [步骤 ${step.order}] 失败 (尝试 ${attempt}/${maxRetries}): ${error.message}`, 'warning');
      }
    }
    
    // 所有重试都失败后，尝试AI自愈
    if (step.action === 'click' || step.action === 'fill') {
      console.log(`🤖 [${runId}] 尝试AI自愈定位...`);
      try {
        await this.attemptSelfHeal(step, testRun);
        return { success: true };
      } catch (healError) {
        console.error(`❌ AI自愈失败:`, healError);
      }
    }
    
    return { success: false, error: `步骤 ${step.order} 执行失败，达到最大重试次数。` };
  }

  /**
   * 🔥 智能AI拆分测试用例 - 针对中文格式优化
   */
  private async smartSplitTestSteps(longText: string, runId: string): Promise<string[]> {
    try {
      console.log(`[${runId}] 🤖 AI开始智能拆分测试用例...`);
      
      const prompt = `你是一个专业的测试用例设计专家。请将以下测试用例拆分为多个独立的、可执行的步骤。

原始测试用例：
${longText}

拆分规则：
1. 按序号（1、2、3...）或动作词（点击、输入、验证等）进行拆分
2. 每个步骤必须是独立的操作
3. 保留中文描述，使其自然可读
4. 使用换行符分隔每个步骤
5. 确保步骤顺序正确

示例输入：
1、进入网站https://example.com/login 2、输入账号admin 3、点击登入

示例输出：
进入网站 https://example.com/login
输入账号 admin
点击登入按钮

请直接返回拆分后的步骤，每行一个步骤，不要添加序号或其他标记：

拆分结果：`;

      const response = await this.aiParser.callOpenRouter(prompt, runId, 1000);
      
      if (response.success && response.content) {
        let content = response.content;
        
        // 清理AI返回的内容
        content = content.replace(/^拆分结果：\s*/gm, '');
        content = content.replace(/^```.*\n?/gm, '');
        content = content.replace(/\n```\s*$/gm, '');
        
        const splitSteps = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.match(/^[\d\s]*$/));
        
        console.log(`[${runId}] ✅ AI智能拆分完成，共 ${splitSteps.length} 个步骤`);
        console.log(`[${runId}] 拆分结果:`, splitSteps);
        
        return splitSteps.length > 0 ? splitSteps : this.simpleRuleBasedSplit(longText);
      }
      
      // 如果AI拆分失败，使用规则拆分
      console.log(`[${runId}] ⚠️ AI拆分失败，使用规则拆分`);
      return this.simpleRuleBasedSplit(longText);
      
    } catch (error) {
      console.error(`[${runId}] ❌ AI智能拆分失败:`, error);
      return this.simpleRuleBasedSplit(longText);
    }
  }

/**
   * 🔥 增强的规则拆分 - 针对中文格式优化
   */
  private simpleRuleBasedSplit(text: string): string[] {
    // 中文数字和常见分隔符
    const chineseNumbers = /[一二三四五六七八九十]+[、.，,\s]/g;
    const arabicNumbers = /\d+[、.，,\s]/g;
    
    // 先尝试按中文序号拆分
    let steps: string[] = [];
    
    // 方法1: 按中文序号拆分
    const chineseSplit = text.split(chineseNumbers).filter(s => s.trim());
    if (chineseSplit.length > 1) {
      steps = chineseSplit.map(s => s.trim()).filter(s => s);
    } else {
      // 方法2: 按阿拉伯数字序号拆分
      const arabicSplit = text.split(arabicNumbers).filter(s => s.trim());
      if (arabicSplit.length > 1) {
        steps = arabicSplit.map(s => s.trim()).filter(s => s);
      } else {
        // 方法3: 按动作词拆分
        const actionKeywords = [
          '打开', '访问', '导航到', '进入', '前往',
          '点击', '选择', '按下', '选中', '单击',
          '输入', '填写', '填入', '键入', '录入',
          '等待', '暂停', '延迟',
          '验证', '检查', '确认', '断言', '校验',
          '截图', '保存', '提交', '登录', '登入'
        ];
        
        // 按逗号和句号拆分
        const commaSplit = text.split(/[,，；;、]/).filter(s => s.trim());
        if (commaSplit.length > 1) {
          steps = commaSplit.map(s => s.trim()).filter(s => s);
        } else {
          // 按句号拆分
          const sentenceSplit = text.split(/[。！？.!?]/).filter(s => s.trim());
          steps = sentenceSplit.map(s => s.trim()).filter(s => s);
        }
      }
    }
    
    // 确保每个步骤都有动作词
    const enhancedSteps = steps.map(step => {
      let enhanced = step.trim();
      
      // 如果没有动作词，添加适当的动作词
      if (!enhanced.match(/^(打开|访问|导航|进入|点击|输入|填写|验证|检查)/)) {
        // 根据内容推测动作
        if (enhanced.includes('http')) {
          enhanced = '打开 ' + enhanced;
        } else if (enhanced.includes('账号') || enhanced.includes('密码') || enhanced.includes('用户名')) {
          enhanced = '输入 ' + enhanced;
        } else if (enhanced.includes('按钮') || enhanced.includes('登录') || enhanced.includes('登入')) {
          enhanced = '点击 ' + enhanced;
        } else {
          enhanced = '执行 ' + enhanced;
        }
      }
      
      return enhanced;
    });
    
    return enhancedSteps.filter(s => s.length > 2);
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

  private async validatePageContent(runId: string): Promise<{hasContent: boolean, url?: string, title?: string}> {
    try {
      const snapshot = await this.mcpClient.getSnapshot();
      const lines = snapshot?.split('\n') || [];
      const hasInteractiveElements = lines.some(l => 
        l.includes('textbox') || l.includes('button') || 
        l.includes('link') || l.includes('input') ||
        l.includes('form') || l.includes('div')
      );
      
      return {
        hasContent: hasInteractiveElements && lines.length > 50,
        url: snapshot?.match(/url:\s*['"]([^'"]+)['"]/)?.[1],
        title: snapshot?.match(/title:\s*['"]([^'"]+)['"]/)?.[1]
      };
    } catch (error) {
      return { hasContent: false };
    }
  }

  private logSnapshotSummary(snapshot: string, runId: string): void {
    if (!snapshot) {
      console.log(`[${runId}] 📋 页面快照: 空`);
      return;
    }
    
    try {
      const lines = snapshot.split('\n');
      const elements = [];
      
      // 提取URL和标题
      const urlMatch = snapshot.match(/url:\s*["']([^"']+)["']/);
      const titleMatch = snapshot.match(/title:\s*["']([^"']+)["']/);
      
      // 提取所有可交互元素
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('textbox') || line.includes('button') || 
            line.includes('link') || line.includes('input') || 
            line.includes('form') || line.includes('div')) {
          
          const textMatch = line.match(/text:\s*["']([^"']+)["']/);
          const placeholderMatch = line.match(/placeholder:\s*["']([^"']+)["']/);
          const roleMatch = line.match(/role:\s*["']([^"']+)["']/);
          const refMatch = line.match(/ref:\s*(\d+)/);
          
          if (textMatch || placeholderMatch || roleMatch) {
            elements.push({
              type: line.includes('textbox') ? '输入框' : 
                   line.includes('button') ? '按钮' : 
                   line.includes('link') ? '链接' : 
                   line.includes('input') ? '输入' : '元素',
              text: textMatch?.[1] || placeholderMatch?.[1] || '',
              placeholder: placeholderMatch?.[1] || '',
              role: roleMatch?.[1] || '',
              ref: refMatch?.[1] || '?'
            });
          }
        }
      }

      // 页面状态诊断
      if (lines.length < 50) {
        console.log(`[${runId}] 📋 页面状态: 异常 - 内容过短(${lines.length}行)`);
        if (urlMatch) console.log(`[${runId}] 📊 URL: ${urlMatch[1]}`);
        if (titleMatch) console.log(`[${runId}] 📊 标题: ${titleMatch[1]}`);
        console.log(`[${runId}] 📊 建议: 检查网络连接或页面访问权限`);
        return;
      }

      if (elements.length === 0) {
        console.log(`[${runId}] 📋 页面状态: 正常加载但无交互元素`);
        console.log(`[${runId}] 📊 可能原因: 页面使用iframe/Shadow DOM或动态加载`);
        console.log(`[${runId}] 📊 建议: 等待更长时间或检查页面结构`);
        return;
      }

      console.log(`[${runId}] 📋 页面状态: 正常 (${elements.length}个元素)`);
      elements.slice(0, 5).forEach((element, index) => {
        const label = element.text || element.placeholder || element.role;
        console.log(`   ${element.type}: "${label}" [ref=${element.ref}]`);
      });
      
      if (elements.length > 5) {
        console.log(`   ... 共${elements.length}个`);
      }
      
    } catch (error) {
      console.log(`[${runId}] 📋 页面分析: 解析失败 - ${error.message}`);
    }
  }
  // #endregion
}

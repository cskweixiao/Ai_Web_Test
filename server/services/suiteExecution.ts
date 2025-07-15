import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';
import { TestSuite, TestSuiteRun, SuiteExecutionOptions } from '../types/tests.js';
import { TestExecutionService } from './testExecution.js';
import { WebSocketManager } from './websocket.js';
import { PrismaClient } from '../../src/generated/prisma';

// 🔥 测试套件服务：负责套件管理和批量执行
export class SuiteExecutionService {
  private wsManager: WebSocketManager;
  private testExecutionService: TestExecutionService;
  private runningSuites: Map<string, TestSuiteRun> = new Map();
  private prisma: PrismaClient;
  
  constructor(wsManager: WebSocketManager, testExecutionService: TestExecutionService) {
    this.wsManager = wsManager;
    this.testExecutionService = testExecutionService;
    this.prisma = new PrismaClient();
  }

  public setExternalSuiteFinder(finder: (id: number) => TestSuite | null) {
    // This method is no longer needed as all suites are managed in the database.
    // Keeping it for now, but it will be removed in a future edit.
  }

  // 🔥 获取所有测试套件 - 从数据库读取
  public async getAllTestSuites(): Promise<TestSuite[]> {
    try {
      const dbSuites = await this.prisma.test_suites.findMany({
        include: {
          suite_case_map: {
            select: {
              case_id: true
            }
          },
          users: {
            select: {
              email: true
            }
          }
        }
      });

      return dbSuites.map(dbSuite => {
        const metadata = dbSuite.metadata as Record<string, any> || {};
        return {
          id: dbSuite.id,
          name: dbSuite.name,
          description: metadata.description as string,
          owner: dbSuite.users.email,
          tags: metadata.tags as string[] || [],
          testCaseIds: dbSuite.suite_case_map.map(map => map.case_id),
          createdAt: dbSuite.created_at?.toISOString() || new Date().toISOString(),
          updatedAt: metadata.updated_at as string || new Date().toISOString(),
          environment: metadata.environment as string,
          priority: (metadata.priority as 'high' | 'medium' | 'low') || 'medium',
          status: (metadata.status as 'active' | 'draft' | 'disabled') || 'active'
        };
      });
    } catch (error) {
      console.error('❌ 获取测试套件失败:', error);
      throw new Error(`Failed to fetch test suites: ${error.message}`);
    }
  }

  // 🔥 创建测试套件 - 保存到数据库
  public async createTestSuite(suiteData: any): Promise<TestSuite> {
    try {
      // 确保提供了必要字段
      if (!suiteData.name) {
        throw new Error('Suite name is required');
      }
      if (!suiteData.testCases || !Array.isArray(suiteData.testCases) || suiteData.testCases.length === 0) {
        throw new Error('At least one test case must be specified');
      }
      
      // 准备元数据
      const metadata = {
        description: suiteData.description || '',
        tags: suiteData.tags || [],
        environment: suiteData.environment || 'staging',
        priority: suiteData.priority || 'medium',
        status: suiteData.status || 'active',
        updated_at: new Date().toISOString()
      };

      // 查找有效的用户ID - 获取系统中的第一个用户作为默认用户
      const defaultOwner = await this.prisma.users.findFirst({
        select: { id: true }
      });

      if (!defaultOwner && !suiteData.ownerId) {
        throw new Error('无法创建测试套件：系统中没有可用的用户账号');
      }

      const ownerId = suiteData.ownerId || defaultOwner?.id;

      // 创建事务，同时创建套件和映射关系
      const result = await this.prisma.$transaction(async (tx) => {
        // 创建测试套件
        const suite = await tx.test_suites.create({
          data: {
            name: suiteData.name,
            owner_id: ownerId, // 使用找到的有效用户ID
            metadata: metadata
          }
        });

        // 创建测试用例与套件的映射
        for (const caseId of suiteData.testCases) {
          await tx.suite_case_map.create({
            data: {
              suite_id: suite.id,
              case_id: caseId
            }
          });
        }

        return suite;
      });

      // 返回创建的套件
      return {
        id: result.id,
        name: result.name,
        description: metadata.description,
        owner: suiteData.ownerName || 'System',
        tags: metadata.tags,
        testCaseIds: suiteData.testCases,
        createdAt: result.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: metadata.updated_at,
        environment: metadata.environment,
        priority: metadata.priority as 'high' | 'medium' | 'low',
        status: metadata.status as 'active' | 'draft' | 'disabled'
      };
    } catch (error) {
      console.error('❌ 创建测试套件失败:', error);
      throw new Error(`Failed to create test suite: ${error.message}`);
    }
  }

  // 🔥 更新测试套件 - 更新数据库记录
  public async updateTestSuite(id: number, suiteData: any): Promise<TestSuite | null> {
    try {
      // 检查套件是否存在
      const existingSuite = await this.prisma.test_suites.findUnique({
        where: { id },
        include: {
          suite_case_map: true,
          users: {
            select: {
              email: true
            }
          }
        }
      });

      if (!existingSuite) {
        return null;
      }

      // 准备更新的元数据
      const currentMetadata = existingSuite.metadata as any || {};
      const updatedMetadata = {
        ...currentMetadata,
        description: suiteData.description !== undefined ? suiteData.description : currentMetadata.description,
        tags: suiteData.tags !== undefined ? suiteData.tags : currentMetadata.tags,
        environment: suiteData.environment !== undefined ? suiteData.environment : currentMetadata.environment,
        priority: suiteData.priority !== undefined ? suiteData.priority : currentMetadata.priority,
        status: suiteData.status !== undefined ? suiteData.status : currentMetadata.status,
        updated_at: new Date().toISOString()
      };

      // 使用事务更新套件和映射关系
      await this.prisma.$transaction(async (tx) => {
        // 更新套件基本信息
        await tx.test_suites.update({
          where: { id },
          data: {
            name: suiteData.name !== undefined ? suiteData.name : existingSuite.name,
            metadata: updatedMetadata
          }
        });

        // 如果提供了新的测试用例列表，更新映射关系
        if (suiteData.testCases) {
          // 删除现有映射
          await tx.suite_case_map.deleteMany({
            where: { suite_id: id }
          });

          // 创建新映射
          for (const caseId of suiteData.testCases) {
            await tx.suite_case_map.create({
              data: {
                suite_id: id,
                case_id: caseId
              }
            });
          }
        }
      });

      // 获取更新后的测试用例列表
      const updatedMappings = await this.prisma.suite_case_map.findMany({
        where: { suite_id: id },
        select: { case_id: true }
      });

      // 返回更新后的套件
      return {
        id,
        name: suiteData.name !== undefined ? suiteData.name : existingSuite.name,
        description: updatedMetadata.description,
        owner: existingSuite.users.email,
        tags: updatedMetadata.tags,
        testCaseIds: updatedMappings.map(m => m.case_id),
        createdAt: existingSuite.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: updatedMetadata.updated_at,
        environment: updatedMetadata.environment,
        priority: updatedMetadata.priority as 'high' | 'medium' | 'low',
        status: updatedMetadata.status as 'active' | 'draft' | 'disabled'
      };
    } catch (error) {
      console.error('❌ 更新测试套件失败:', error);
      throw new Error(`Failed to update test suite: ${error.message}`);
    }
  }

  // 🔥 删除测试套件 - 从数据库删除
  public async deleteTestSuite(id: number): Promise<boolean> {
    try {
      // 检查套件是否存在
      const existingSuite = await this.prisma.test_suites.findUnique({
        where: { id }
      });

      if (!existingSuite) {
        return false;
      }

      // 删除套件（级联删除会自动删除关联的映射记录）
      await this.prisma.test_suites.delete({
        where: { id }
      });

      return true;
    } catch (error) {
      console.error('❌ 删除测试套件失败:', error);
      throw new Error(`Failed to delete test suite: ${error.message}`);
    }
  }

  // 🔥 执行整个测试套件
  public async runSuite(
    suiteId: number, 
    options: SuiteExecutionOptions | string = {}
  ): Promise<string> {
    const suiteRunId = uuidv4();
    const opts: SuiteExecutionOptions = typeof options === 'string' ? { environment: options } : options;
    const environment = opts.environment || 'production';
    const executionMode = opts.executionMode || 'standard';
    const continueOnFailure = opts.continueOnFailure !== false; // 默认true
    const concurrency = opts.concurrency || 2; // 从options读取或默认2

    try {
      const suite = await this.findSuiteById(suiteId);
      if (!suite) {
        throw new Error(`Suite with ID ${suiteId} not found`);
      }
      
      const dbRun = await this.createTestRunRecord(suiteId, suiteRunId);

      this.createSuiteRun(suiteRunId, suite, environment);
      
      this.executeSuiteAsync(
        suiteRunId, 
        suite, 
        environment, 
        executionMode, 
        continueOnFailure,
        concurrency // 传递并发数
      ).catch(error => {
        console.error(`[${suiteRunId}] executeSuiteAsync promise被拒绝:`, error);
        this.updateSuiteStatus(suiteRunId, 'failed', error.message);
      });

      return suiteRunId;
    } catch (error: any) {
      console.error('❌ 启动套件执行失败:', error);
      // We can't easily send a WebSocket message here because we don't have a runId yet
      // if createSuiteRun failed. The client will have to handle the failed HTTP request.
      throw error;
    }
  }

  // 🔥 在数据库中创建测试运行记录
  private async createTestRunRecord(suiteId: number, runId: string): Promise<any> {
    try {
      // 查找有效的用户ID - 获取系统中的第一个用户作为默认用户
      const defaultUser = await this.prisma.users.findFirst({
        select: { id: true }
      });

      if (!defaultUser) {
        throw new Error('系统中没有可用的用户账号，无法创建测试运行记录');
      }

      return await this.prisma.test_runs.create({
        data: {
          suite_id: suiteId,
          trigger_user_id: defaultUser.id, // 使用找到的有效用户
          status: 'PENDING',
          started_at: new Date()
        }
      });
    } catch (error) {
      console.error('❌ 创建测试运行记录失败:', error);
      throw new Error(`Failed to create test run record: ${error.message}`);
    }
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
    try {
      // 从数据库获取套件信息
      const dbSuite = await this.prisma.test_suites.findUnique({
        where: { id },
        include: {
          suite_case_map: {
            select: {
              case_id: true
            }
          },
          users: {
            select: {
              email: true
            }
          }
        }
      });

      if (!dbSuite) {
        return null;
      }

      // 转换为应用层对象
      const metadata = dbSuite.metadata as Record<string, any> || {};
      return {
        id: dbSuite.id,
        name: dbSuite.name,
        description: metadata.description as string,
        owner: dbSuite.users.email,
        tags: metadata.tags as string[] || [],
        testCaseIds: dbSuite.suite_case_map.map(map => map.case_id),
        createdAt: dbSuite.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: metadata.updated_at as string || new Date().toISOString(),
        environment: metadata.environment as string,
        priority: (metadata.priority as 'high' | 'medium' | 'low') || 'medium',
        status: (metadata.status as 'active' | 'draft' | 'disabled') || 'active'
      };
    } catch (error) {
      console.error('❌ 获取测试套件失败:', error);
      return null;
    }
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
      executor: 'System',
      environment: environment || 'default',
      testRuns: []
    };

    this.runningSuites.set(suiteRunId, suiteRun);
    
    // 使用WebSocket发送更新
    if (this.wsManager) {
      // 将Date对象转换为ISO字符串
      const sanitizedData = {
        ...suiteRun,
        startTime: suiteRun.startTime ? suiteRun.startTime.toISOString() : null
      };
      
      // 通过broadcast发送套件更新
      this.wsManager.broadcast({
        type: 'suiteUpdate', 
        runId: suiteRunId,
        data: sanitizedData
      });
      
      console.log(`已发送套件创建消息: ${suiteRunId}, ${suite.name}`);
    }
    
    console.log(`✅ 创建套件执行记录: ${suite.name} (${suiteRunId})`);
  }

  private broadcastProgress(suiteRunId: string, suiteRun: TestSuiteRun): void {
    const progress = suiteRun.totalCases > 0 ? Math.round((suiteRun.completedCases / suiteRun.totalCases) * 100) : 0;
    suiteRun.progress = progress;
    this.wsManager.sendToAll(JSON.stringify({
        type: 'suiteUpdate',
        payload: {
            id: suiteRunId,
            progress: progress,
            status: suiteRun.status,
            passed: suiteRun.passedCases,
            failed: suiteRun.failedCases,
            total: suiteRun.totalCases,
            completed: suiteRun.completedCases
        }
    }));
  }

  private async executeSuiteAsync(
    suiteRunId: string,
    suite: TestSuite,
    environment: string,
    executionMode: string,
    continueOnFailure: boolean,
    concurrency: number
  ) {
    const suiteRun = this.runningSuites.get(suiteRunId);
    if (!suiteRun) return;

    const limit = pLimit(concurrency);
    console.log(`[${suiteRunId}] 🚀 套件执行开始，并发数: ${concurrency}`);

    try {
      suiteRun.status = 'running';
      this.broadcastProgress(suiteRunId, suiteRun);

      const sortedTestCaseIds = await this.analyzeTestOrder(suite.testCaseIds);
      suiteRun.totalCases = sortedTestCaseIds.length;
      
      const testPromises = sortedTestCaseIds.map((testCaseId, index) => {
        return limit(async () => {
          if (suiteRun.status === 'cancelled' || (!continueOnFailure && suiteRun.failedCases > 0)) {
            console.log(`[${suiteRunId}] 套件执行中止，跳过剩余测试.`);
            return;
          }

          const testCase = await this.testExecutionService.findTestCaseById(testCaseId);
          const testCaseName = testCase ? testCase.name : `ID ${testCaseId}`;
          console.log(`[${suiteRunId}] [${index + 1}/${suiteRun.totalCases}] 开始执行测试用例: ${testCaseName}`);

          try {
            const testRunId = await this.testExecutionService.runTest(
              testCaseId, 
              environment, 
              executionMode,
              {
                reuseBrowser: true,
                suiteId: suiteRunId,
                contextState: this.testExecutionService.getSharedContext(suiteRunId),
              }
            );

            suiteRun.testRuns.push(testRunId);

            const testResult = await this.waitForTestCompletion(testRunId);

            suiteRun.completedCases++;

            if (!testResult.success) {
              suiteRun.failedCases++;
            } else {
              suiteRun.passedCases++;
            }
            this.broadcastProgress(suiteRunId, suiteRun);

          } catch (error: any) {
            suiteRun.completedCases++;
            suiteRun.failedCases++;
            console.log(`[${suiteRunId}] 执行测试用例 ${testCaseName} 时发生严重错误: ${error.message}`);
          } finally {
            this.broadcastProgress(suiteRunId, suiteRun);
          }
        });
      });

      await Promise.all(testPromises);

      if (suiteRun.status === 'running') {
        suiteRun.status = suiteRun.failedCases === 0 ? 'completed' : 'failed';
      }

    } catch (error: any) {
      await this.updateSuiteStatus(suiteRunId, 'failed', error.message);
    }
  }
  
  // 发送进度更新的辅助方法
  private async analyzeTestOrder(testCaseIds: number[]): Promise<number[]> {
    // 目前我们只返回原始顺序，后续可以实现更复杂的依赖分析和排序
    // 例如基于测试用例元数据的依赖关系确定最优执行顺序
    return [...testCaseIds];
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

  private async updateSuiteStatus(suiteRunId: string, status: TestSuiteRun['status'], error?: string) {
    const suiteRun = this.runningSuites.get(suiteRunId);
    if (!suiteRun) return;
    
    // 更新内存中的状态
    suiteRun.status = status;
    if (error) suiteRun.error = error;
    
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      suiteRun.endTime = new Date();
      const durationMs = suiteRun.endTime.getTime() - suiteRun.startTime.getTime();
      suiteRun.duration = this.formatDuration(durationMs);
      
      // 🔥 套件完成时，确保进度值为100%
      if (status === 'completed') {
        suiteRun.progress = 100;
      }
    }
    
    // 使用WebSocket发送更新
    if (this.wsManager) {
      try {
        // 将Date对象转换为ISO字符串
        const sanitizedData = {
          ...suiteRun,
          startTime: suiteRun.startTime ? suiteRun.startTime.toISOString() : null,
          endTime: suiteRun.endTime ? suiteRun.endTime.toISOString() : null
        };
        
        // 🔥 使用一致的消息格式
        this.wsManager.broadcast({
          type: 'suiteUpdate', 
          runId: suiteRunId,
          data: sanitizedData
        });
        
        console.log(`已发送套件状态更新: ${suiteRunId}, 状态: ${status}, 进度: ${suiteRun.progress}%`);
        
        // 🔥 对于已完成的测试，发送额外的完成通知，确保前端可以接收到
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
          setTimeout(() => {
            // 延迟再发一次以确保前端接收
            this.wsManager.broadcast({
              type: 'suiteUpdate',
              runId: suiteRunId,
              data: {
                ...sanitizedData,
                finalStatus: true // 添加标志指示这是最终状态更新
              }
            });
            
            console.log(`已发送套件最终状态更新: ${suiteRunId}, 状态: ${status}`);
            
            // 🔥 套件完成后，清理内存中的套件运行记录
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
              setTimeout(() => {
                if (this.runningSuites.has(suiteRunId)) {
                  console.log(`🧹 清理已完成的套件运行记录: ${suiteRunId}`);
                  this.runningSuites.delete(suiteRunId);
                }
              }, 5000); // 延迟5秒后清理
            }
          }, 1000); // 延迟1秒发送
        }
      } catch (wsError) {
        console.error(`WebSocket广播套件状态更新失败: ${wsError.message}`);
      }
    }
    
    // 🔥 更新数据库中的执行状态
    try {
      // 获取数据库中的测试运行记录 ID
      const dbRunResult = await this.prisma.test_runs.findFirst({
        where: {
          suite_id: suiteRun.suiteId,
          started_at: {
            // 大致匹配启动时间，允许几秒钟的误差
            gte: new Date(suiteRun.startTime.getTime() - 10000),
            lte: new Date(suiteRun.startTime.getTime() + 10000)
          }
        },
        orderBy: {
          started_at: 'desc'
        }
      });
      
      if (!dbRunResult) {
        console.warn(`❓ 找不到匹配的测试运行记录: suiteId=${suiteRun.suiteId}, time=${suiteRun.startTime}`);
        return;
      }
      
      // 映射状态
      let dbStatus: any;
      switch (status) {
        case 'running':
          dbStatus = 'RUNNING';
          break;
        case 'completed':
          dbStatus = suiteRun.failedCases > 0 ? 'FAILED' : 'PASSED';
          break;
        case 'failed':
          dbStatus = 'FAILED';
          break;
        case 'cancelled':
          dbStatus = 'CANCELLED';
          break;
        default:
          dbStatus = 'PENDING';
      }
      
      // 更新数据库状态
      await this.prisma.test_runs.update({
        where: { id: dbRunResult.id },
        data: {
          status: dbStatus,
          finished_at: status === 'completed' || status === 'failed' || status === 'cancelled' 
            ? new Date() 
            : undefined
        }
      });
      
      // 如果测试完成，生成报告
      if (status === 'completed' || status === 'failed') {
        await this.generateTestReport(dbRunResult.id, suiteRun);
      }
      
    } catch (error) {
      console.error('❌ 更新测试运行状态失败:', error);
    }
  }
  
  // 🔥 生成测试报告并保存到数据库
  private async generateTestReport(dbRunId: number, suiteRun: TestSuiteRun): Promise<void> {
    try {
      const summary = {
        totalCases: suiteRun.totalCases,
        passedCases: suiteRun.passedCases,
        failedCases: suiteRun.failedCases,
        duration: suiteRun.duration,
        passRate: suiteRun.totalCases > 0 
          ? Math.round((suiteRun.passedCases / suiteRun.totalCases) * 100) 
          : 0,
        testRuns: suiteRun.testRuns
      };
      
      await this.prisma.reports.create({
        data: {
          run_id: dbRunId,
          summary,
          generated_at: new Date()
        }
      });
      
      console.log(`📊 [Suite ${suiteRun.id}] 测试报告已生成并保存`);
      
    } catch (error) {
      console.error('❌ 生成测试报告失败:', error);
    }
  }
  
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // 🔥 取消套件执行
  public async cancelSuite(suiteRunId: string): Promise<boolean> {
    const suiteRun = this.runningSuites.get(suiteRunId);
    if (!suiteRun || suiteRun.status !== 'running') {
      return false;
    }

    await this.updateSuiteStatus(suiteRunId, 'cancelled');
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
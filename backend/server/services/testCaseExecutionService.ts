/**
 * 测试用例执行记录服务
 * 负责持久化测试执行数据到数据库
 * 支持数据隔离（按用户/部门）
 */

import { PrismaClient } from '../../src/generated/prisma/index.js';
import { DatabaseService } from './databaseService.js';
import type { TestRun, TestLog } from '../../../front/src/types/test.js';
import { getNow } from '../utils/timezone.js';

interface TestCaseExecutionData {
  id: string; // UUID
  testCaseId: number;
  testCaseTitle: string;
  environment: string;
  executionMode: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'error';

  // 执行者信息
  executorUserId?: number;
  executorDepartment?: string;

  // 时间信息
  queuedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;

  // 执行统计
  totalSteps: number;
  completedSteps: number;
  passedSteps: number;
  failedSteps: number;
  progress: number; // 0-100

  // 错误信息
  errorMessage?: string;

  // 关联数据
  executionLogs?: any; // JSON
  screenshots?: any; // JSON
  artifacts?: any; // JSON
  metadata?: any; // JSON
}

export class TestCaseExecutionService {
  private static instance: TestCaseExecutionService;
  private prisma: PrismaClient;

  private constructor() {
    const databaseService = DatabaseService.getInstance();
    this.prisma = databaseService.getClient();
  }

  static getInstance(): TestCaseExecutionService {
    if (!TestCaseExecutionService.instance) {
      TestCaseExecutionService.instance = new TestCaseExecutionService();
    }
    return TestCaseExecutionService.instance;
  }

  /**
   * 创建新的测试执行记录
   */
  async createExecution(data: {
    id: string;
    testCaseId: number;
    testCaseTitle: string;
    environment: string;
    executionMode?: string;
    executorUserId?: number;
    executorDepartment?: string;
  }): Promise<TestCaseExecutionData> {
    try {
      const execution = await this.prisma.test_case_executions.create({
        data: {
          id: data.id,
          test_case_id: data.testCaseId,
          test_case_title: data.testCaseTitle,
          environment: data.environment,
          execution_mode: data.executionMode || 'standard',
          status: 'queued',
          executor_user_id: data.executorUserId,
          executor_project: data.executorDepartment,
          queued_at: getNow(),
          total_steps: 0,
          completed_steps: 0,
          passed_steps: 0,
          failed_steps: 0,
          progress: 0,
        },
      });

      console.log(`✅ [${data.id}] 创建测试执行记录成功`);
      return this.mapToExecutionData(execution);
    } catch (error) {
      console.error(`❌ [${data.id}] 创建测试执行记录失败:`, error);
      throw error;
    }
  }

  /**
   * 更新测试执行状态
   */
  // 🔥 更新执行时长（由前端计算并发送，同时更新开始和结束时间）
  async updateExecutionDuration(
    id: string, 
    durationMs: number, 
    startedAt?: string | number | Date,
    finishedAt?: string | number | Date
  ): Promise<void> {
    try {
      const updateData: any = {
        duration_ms: durationMs
      };

      // 如果提供了开始时间，更新 started_at
      // 前端传入的是本地时间的24小时制格式（如 "2025-12-11 17:48:23.234"）
      // 🔥 修复：直接使用前端传入的时间，不添加偏移量，确保与前端计算的 durationMs 一致
      if (startedAt) {
        let startDate: Date;
        if (startedAt instanceof Date) {
          startDate = startedAt;
        } else if (typeof startedAt === 'string') {
          // 解析24小时制格式：yyyy-MM-dd HH:mm:ss.SSS
          // 如果包含 'T' 或 'Z'，说明是 ISO 格式，直接解析
          if (startedAt.includes('T') || startedAt.includes('Z')) {
            startDate = new Date(startedAt);
          } else {
            // 🔥 关键修复：直接使用 new Date() 构造函数解析本地时间字符串
            // 将 "yyyy-MM-dd HH:mm:ss.SSS" 格式转换为 ISO 格式 "yyyy-MM-ddTHH:mm:ss.SSS"
            const isoString = startedAt.replace(' ', 'T');
            startDate = new Date(isoString);
            
            if (isNaN(startDate.getTime())) {
              throw new Error(`无法解析开始时间: ${startedAt}`);
            }
          }
        } else {
          startDate = new Date(startedAt);
        }
        updateData.started_at = startDate;
        console.log(`📅 [${id}] 更新开始时间: ${startDate.toISOString()} (前端传入: ${startedAt})`);
      }

      // 如果提供了结束时间，更新 finished_at
      if (finishedAt) {
        let endDate: Date;
        if (finishedAt instanceof Date) {
          endDate = finishedAt;
        } else if (typeof finishedAt === 'string') {
          // 解析24小时制格式：yyyy-MM-dd HH:mm:ss.SSS
          if (finishedAt.includes('T') || finishedAt.includes('Z')) {
            endDate = new Date(finishedAt);
          } else {
            // 🔥 关键修复：直接使用 new Date() 构造函数解析本地时间字符串
            // 将 "yyyy-MM-dd HH:mm:ss.SSS" 格式转换为 ISO 格式 "yyyy-MM-ddTHH:mm:ss.SSS"
            const isoString = finishedAt.replace(' ', 'T');
            endDate = new Date(isoString);
            
            if (isNaN(endDate.getTime())) {
              throw new Error(`无法解析结束时间: ${finishedAt}`);
            }
          }
        } else {
          endDate = new Date(finishedAt);
        }
        updateData.finished_at = endDate;
        console.log(`📅 [${id}] 更新结束时间: ${endDate.toISOString()} (前端传入: ${finishedAt})`);
      }

      await this.prisma.test_case_executions.update({
        where: { id },
        data: updateData
      });
      
      // 🔥 验证时间一致性：计算数据库中的时间差是否与 durationMs 一致
      if (updateData.started_at && updateData.finished_at) {
        const dbDuration = updateData.finished_at.getTime() - updateData.started_at.getTime();
        const isConsistent = Math.abs(dbDuration - durationMs) < 10; // 允许10ms误差
        console.log(`✅ [${id}] 更新执行时长成功: ${durationMs}ms`);
        console.log(`📊 [${id}] 时间一致性检查:`, {
          前端计算的时长: `${durationMs}ms`,
          数据库时间差: `${dbDuration}ms`,
          是否一致: isConsistent ? '✅ 一致' : '❌ 不一致',
          误差: `${Math.abs(dbDuration - durationMs)}ms`
        });
      } else {
        console.log(`✅ [${id}] 更新执行时长成功: ${durationMs}ms`);
      }
    } catch (error) {
      console.error(`❌ [${id}] 更新执行时长失败:`, error);
      throw error;
    }
  }

  async updateExecution(
    id: string,
    updates: Partial<{
      status: TestCaseExecutionData['status'];
      startedAt: Date;
      finishedAt: Date;
      durationMs: number;
      totalSteps: number;
      completedSteps: number;
      passedSteps: number;
      failedSteps: number;
      progress: number;
      errorMessage: string;
      executionLogs: any;
      screenshots: any;
      artifacts: any;
      metadata: any;
    }>
  ): Promise<TestCaseExecutionData> {
    try {
      const execution = await this.prisma.test_case_executions.update({
        where: { id },
        data: {
          ...(updates.status && { status: updates.status }),
          ...(updates.startedAt && { started_at: updates.startedAt }),
          ...(updates.finishedAt && { finished_at: updates.finishedAt }),
          ...(updates.durationMs !== undefined && { duration_ms: updates.durationMs }),
          ...(updates.totalSteps !== undefined && { total_steps: updates.totalSteps }),
          ...(updates.completedSteps !== undefined && { completed_steps: updates.completedSteps }),
          ...(updates.passedSteps !== undefined && { passed_steps: updates.passedSteps }),
          ...(updates.failedSteps !== undefined && { failed_steps: updates.failedSteps }),
          ...(updates.progress !== undefined && { progress: updates.progress }),
          ...(updates.errorMessage && { error_message: updates.errorMessage }),
          ...(updates.executionLogs && { execution_logs: updates.executionLogs }),
          ...(updates.screenshots && { screenshots: updates.screenshots }),
          ...(updates.artifacts && { artifacts: updates.artifacts }),
          ...(updates.metadata && { metadata: updates.metadata }),
        },
      });

      return this.mapToExecutionData(execution);
    } catch (error) {
      console.error(`❌ [${id}] 更新测试执行记录失败:`, error);
      throw error;
    }
  }

  /**
   * 获取单个测试执行记录
   */
  async getExecution(id: string): Promise<TestCaseExecutionData | null> {
    try {
      const execution = await this.prisma.test_case_executions.findUnique({
        where: { id },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              email: true,
              account_name: true
            }
          }
        },
      });

      if (!execution) {
        return null;
      }

      const mappedData = this.mapToExecutionData(execution);
      // 🔥 添加用户信息
      (mappedData as any).executorUsername = execution.users?.username || null;
      (mappedData as any).executorEmail = execution.users?.email || null;
      
      return mappedData;
    } catch (error) {
      console.error(`❌ [${id}] 获取测试执行记录失败:`, error);
      return null;
    }
  }

  /**
   * 获取单个测试执行记录（别名方法，用于兼容性）
   */
  async getExecutionById(id: string): Promise<TestCaseExecutionData | null> {
    return this.getExecution(id);
  }

  /**
   * 获取测试执行列表（支持数据隔离）
   */
  async getExecutions(filters?: {
    testCaseId?: number;
    executorUserId?: number;
    executorDepartment?: string;
    status?: TestCaseExecutionData['status'];
    limit?: number;
    offset?: number;
  }): Promise<TestCaseExecutionData[]> {
    try {
      // 🔥 构建查询条件
      const where: any = {};
      
      if (filters?.testCaseId) {
        where.test_case_id = filters.testCaseId;
      }
      
      // 🔥 修复：当提供了 executorUserId 时，查询该用户的记录 + 系统记录（null）
      // 如果没有提供（undefined），则查询所有记录
      if (filters?.executorUserId !== undefined) {
        // 使用 OR 条件：查询该用户执行的记录 OR 系统执行的记录（executor_user_id 为 null）
        // 注意：如果同时有 executorDepartment 条件，需要特殊处理
        if (filters?.executorDepartment) {
          // 如果有部门条件，系统记录可能没有部门，所以只查询该用户的记录
          where.executor_user_id = filters.executorUserId;
          where.executor_project = filters.executorDepartment;
        } else {
          // 没有部门条件时，查询该用户的记录 + 系统记录
          where.OR = [
            { executor_user_id: filters.executorUserId },
            { executor_user_id: null }
          ];
        }
      } else {
        // 没有提供 executorUserId，查询所有记录
        if (filters?.executorDepartment) {
          where.executor_project = filters.executorDepartment;
        }
      }
      
      if (filters?.status) {
        where.status = filters.status;
      }
      
      // 🔥 新增：过滤掉关联用例已删除的记录
      where.test_cases = {
        deleted_at: null
      };
      
      console.log('📊 [TestCaseExecutionService.getExecutions] 查询条件:', JSON.stringify(where, null, 2));
      
      const executions = await this.prisma.test_case_executions.findMany({
        where,
        include: {
          users: {
            select: {
              id: true,
              username: true,
              email: true,
              account_name: true
            }
          },
          // 🔥 新增：关联 test_cases 以检查 deleted_at 字段
          test_cases: {
            select: {
              id: true,
              deleted_at: true
            }
          }
        },
        orderBy: { queued_at: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      });

      console.log(`📊 [TestCaseExecutionService.getExecutions] 查询到 ${executions.length} 条记录`);

      return executions.map(exec => {
        const mappedData = this.mapToExecutionData(exec);
        // 🔥 添加用户信息
        (mappedData as any).executorUsername = exec.users?.username || null;
        (mappedData as any).executorEmail = exec.users?.email || null;
        return mappedData;
      });
    } catch (error) {
      console.error('❌ 获取测试执行列表失败:', error);
      return [];
    }
  }

  /**
   * 从 TestRun 对象同步到数据库
   */
  async syncFromTestRun(testRun: TestRun): Promise<void> {
    try {
      const existingExecution = await this.getExecution(testRun.id);

      // 🔥 关键修复：从日志中提取准确的开始和结束时间
      // 确保使用实际执行的时间，而不是队列时间或其他时间
      let logStartTime: Date | undefined;
      let logEndTime: Date | undefined;
      
      if (testRun.logs && testRun.logs.length > 0) {
        // 对日志按时间戳排序
        const sortedLogs = [...testRun.logs].sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
        
        const firstLog = sortedLogs[0];
        const lastLog = sortedLogs[sortedLogs.length - 1];
        
        logStartTime = firstLog.timestamp instanceof Date ? firstLog.timestamp : new Date(firstLog.timestamp);
        logEndTime = lastLog.timestamp instanceof Date ? lastLog.timestamp : new Date(lastLog.timestamp);
        
        console.log(`📋 [${testRun.id}] 从日志提取时间:`, {
          日志数量: sortedLogs.length,
          开始时间: logStartTime.toISOString(),
          结束时间: logEndTime.toISOString(),
          时长: `${((logEndTime.getTime() - logStartTime.getTime()) / 1000).toFixed(3)}s`
        });
      }
      
      // 🔥 关键修复：先确定要存入数据库的时间，再用这些时间计算 durationMs
      // 优先级：日志时间（最准确）> actualStartedAt/actualEndedAt > 其他时间
      const actualStartedAt = (testRun as any).actualStartedAt;
      const actualEndedAt = testRun.finishedAt;
      
      // 确定要存入数据库的开始时间和结束时间
      // 🔥 优先使用日志时间（第一条和最后一条日志的时间最准确）
      const dbStartedAt: Date | undefined = logStartTime 
        ? logStartTime
        : (actualStartedAt 
          ? new Date(actualStartedAt)
          : (testRun.startedAt ? new Date(testRun.startedAt) : undefined));
      
      const dbFinishedAt: Date | undefined = logEndTime
        ? logEndTime
        : (actualEndedAt
          ? new Date(actualEndedAt)
          : (testRun.endedAt ? new Date(testRun.endedAt) : undefined));
      
      // 🔥 核心：使用将要存入数据库的时间来计算 durationMs
      // 这样确保 duration_ms = finished_at - started_at 完全一致
      let durationMs: number | undefined;
      if (dbStartedAt && dbFinishedAt) {
        durationMs = dbFinishedAt.getTime() - dbStartedAt.getTime();
        
        // 确定数据源
        let dataSource = 'startedAt';
        if (logStartTime && logEndTime) {
          dataSource = '日志时间（最准确）✅';
        } else if (actualStartedAt && actualEndedAt) {
          dataSource = 'actualStartedAt/actualEndedAt';
        }
        
        console.log(`📊 [${testRun.id}] ✅ 最终时间一致性确认:`);
        console.log(`   数据源: ${dataSource}`);
        console.log(`   开始时间: ${dbStartedAt.toISOString()}`);
        console.log(`   结束时间: ${dbFinishedAt.toISOString()}`);
        console.log(`   执行时长: ${durationMs}ms (${(durationMs / 1000).toFixed(3)}s)`);
        console.log(`   验证: finished_at - started_at = ${durationMs}ms ✅`);
      } else if (dbStartedAt && testRun.status === 'running') {
        // 仅在运行中状态才使用当前时间
        durationMs = Date.now() - dbStartedAt.getTime();
        console.log(`📊 [${testRun.id}] 运行中，使用当前时间计算 durationMs: ${durationMs}ms`);
      }

      // 映射状态
      const statusMap: Record<string, TestCaseExecutionData['status']> = {
        'queued': 'queued',
        'running': 'running',
        'completed': 'completed',
        'failed': 'failed',
        'cancelled': 'cancelled',
        'error': 'error',
      };

      const status = statusMap[testRun.status] || 'queued';

      // 🔥 修复：优先使用 testRun 中已计算的字段，如果没有则回退到计算
      const totalSteps = testRun.totalSteps ?? (testRun.steps?.length || 0);
      const completedSteps = testRun.completedSteps ?? (testRun.successfulSteps?.length || 0);
      const passedSteps = testRun.passedSteps ?? (testRun.successfulSteps?.length || 0);
      const failedSteps = testRun.failedSteps ?? ((testRun.steps?.length || 0) - (testRun.successfulSteps?.length || 0));
      
      // 🔥 修复：优先使用 testRun.progress，如果没有则计算
      let progress = testRun.progress;
      if (progress === undefined || progress === null) {
        if (totalSteps > 0) {
          progress = Math.min(100, Math.round((completedSteps / totalSteps) * 100));
        } else {
          progress = testRun.status === 'completed' || testRun.status === 'failed' ? 100 : 0;
        }
      }
      
      // 🔥 关键修复：使用从时间计算的 durationMs，确保一致性
      const finalDurationMs = durationMs;

      const updateData: any = {
        status,
        totalSteps,
        completedSteps,
        passedSteps,
        failedSteps,
        progress,
        errorMessage: testRun.error,
        executionLogs: testRun.logs || [],
        screenshots: testRun.screenshots || [],
        metadata: {
          suiteId: testRun.suiteId,
          reuseBrowser: testRun.reuseBrowser,
          contextState: testRun.contextState ? 'present' : 'none',
        },
      };

      // 🔥 关键修复：始终使用从时间计算的 durationMs 更新数据库
      // 确保内存和数据库的执行时长一致
      if (finalDurationMs !== undefined && finalDurationMs > 0) {
        updateData.durationMs = finalDurationMs;
        console.log(`📊 [${testRun.id}] 更新数据库 durationMs: ${finalDurationMs}ms`);
      }
      
      // 🔥 关键修复：使用与计算 durationMs 相同的时间存入数据库
      // 确保 started_at, finished_at, duration_ms 三者完全一致
      if (dbStartedAt) {
        updateData.startedAt = dbStartedAt;
      }
      if (dbFinishedAt) {
        updateData.finishedAt = dbFinishedAt;
      }

      if (existingExecution) {
        // 更新现有记录
        await this.updateExecution(testRun.id, updateData);
      } else {
        // 创建新记录（如果数据库中不存在）
        // 需要先获取测试用例标题
        const testCase = await this.prisma.test_cases.findUnique({
          where: { id: testRun.testCaseId },
          select: { title: true },
        });

        await this.createExecution({
          id: testRun.id,
          testCaseId: testRun.testCaseId,
          testCaseTitle: testCase?.title || `测试用例 #${testRun.testCaseId}`,
          environment: testRun.environment || 'default',
          executionMode: testRun.executionMode || 'standard',
          executorUserId: testRun.userId ? parseInt(testRun.userId) : undefined,
          executorDepartment: undefined, // TODO: 从用户信息获取
        });

        // 创建后再更新详细信息
        await this.updateExecution(testRun.id, updateData);
      }

      console.log(`✅ [${testRun.id}] 同步测试执行记录成功`);

      // 🔥 新增：测试完成时，创建 test_run_results 记录（用于报告系统）
      if (status === 'completed' || status === 'failed') {
        try {
          await this.createTestRunResult(testRun, status, finalDurationMs);
        } catch (error) {
          // 静默失败，避免影响主流程
          console.error(`⚠️ [${testRun.id}] 创建 test_run_results 记录失败:`, error);
        }
      }
    } catch (error) {
      console.error(`❌ [${testRun.id}] 同步测试执行记录失败:`, error);
      // 不抛出错误，避免影响测试执行
    }
  }

  /**
   * 🔥 新增：创建 test_run_results 记录（用于报告系统）
   */
  private async createTestRunResult(
    testRun: TestRun,
    status: 'completed' | 'failed',
    durationMs?: number
  ): Promise<void> {
    try {
      // 1. 查找或创建 test_runs 记录
      let testRunRecord = await this.findOrCreateTestRun(testRun);

      // 2. 映射状态
      const resultStatus = status === 'completed' ? 'PASSED' : 'FAILED';

      // 3. 检查是否已存在 test_run_results 记录（避免重复创建）
      const existingResult = await this.prisma.test_run_results.findFirst({
        where: {
          run_id: testRunRecord.id,
          case_id: testRun.testCaseId,
          executed_at: testRun.finishedAt || testRun.endedAt 
            ? {
                gte: new Date(new Date(testRun.finishedAt || testRun.endedAt!).getTime() - 1000), // 允许1秒误差
                lte: new Date(new Date(testRun.finishedAt || testRun.endedAt!).getTime() + 1000)
              }
            : undefined
        }
      });

      if (existingResult) {
        console.log(`ℹ️ [${testRun.id}] test_run_results 记录已存在，跳过创建`);
        return;
      }

      // 4. 获取截图URL（如果有）
      let screenshotUrl: string | null = null;
      if (testRun.screenshots && Array.isArray(testRun.screenshots) && testRun.screenshots.length > 0) {
        // 获取最后一张截图
        const lastScreenshot = testRun.screenshots[testRun.screenshots.length - 1];
        if (lastScreenshot && typeof lastScreenshot === 'object' && 'filePath' in lastScreenshot) {
          screenshotUrl = lastScreenshot.filePath as string;
        }
      }

      // 5. 创建 test_run_results 记录
      await this.prisma.test_run_results.create({
        data: {
          run_id: testRunRecord.id,
          case_id: testRun.testCaseId,
          status: resultStatus,
          duration_ms: durationMs || undefined,
          screenshot_url: screenshotUrl,
          executed_at: testRun.finishedAt || testRun.endedAt || getNow()
        }
      });

      console.log(`✅ [${testRun.id}] 创建 test_run_results 记录成功 (run_id: ${testRunRecord.id}, case_id: ${testRun.testCaseId})`);
    } catch (error) {
      console.error(`❌ [${testRun.id}] 创建 test_run_results 记录失败:`, error);
      throw error;
    }
  }

  /**
   * 🔥 新增：查找或创建 test_runs 记录
   */
  private async findOrCreateTestRun(testRun: TestRun): Promise<any> {
    try {
      // 🔥 修复：优先使用 testRunRecordId（如果由套件执行服务传递）
      if ((testRun as any).testRunRecordId) {
        const testRunRecordId = (testRun as any).testRunRecordId as number;
        const existingRun = await this.prisma.test_runs.findUnique({
          where: { id: testRunRecordId }
        });

        if (existingRun) {
          // 更新 test_runs 状态和结束时间
          const runStatus = testRun.status === 'completed' ? 'PASSED' : 
                           testRun.status === 'failed' ? 'FAILED' : 
                           testRun.status === 'cancelled' ? 'CANCELLED' :
                           'RUNNING';
          await this.prisma.test_runs.update({
            where: { id: existingRun.id },
            data: {
              status: runStatus,
              finished_at: testRun.finishedAt || testRun.endedAt || getNow()
            }
          });
          console.log(`✅ [${testRun.id}] 使用套件执行创建的 test_runs 记录 (id: ${existingRun.id})`);
          return existingRun;
        }
      }

      // 如果有 suiteId，尝试查找对应的 test_runs 记录
      if (testRun.suiteId) {
        // suiteId 应该是数字（套件ID）
        const suiteIdNum = typeof testRun.suiteId === 'string' 
          ? parseInt(testRun.suiteId) 
          : testRun.suiteId;

        if (!isNaN(suiteIdNum)) {
          // 查找最近创建的 test_runs 记录（可能由套件执行服务创建）
          const existingRun = await this.prisma.test_runs.findFirst({
            where: {
              suite_id: suiteIdNum,
              started_at: testRun.startedAt
                ? {
                    gte: new Date(new Date(testRun.startedAt).getTime() - 60000), // 允许1分钟误差
                    lte: new Date(new Date(testRun.startedAt).getTime() + 60000)
                  }
                : undefined
            },
            orderBy: {
              started_at: 'desc'
            }
          });

          if (existingRun) {
            // 更新 test_runs 状态和结束时间
            const runStatus = testRun.status === 'completed' ? 'PASSED' : 
                             testRun.status === 'failed' ? 'FAILED' : 
                             testRun.status === 'cancelled' ? 'CANCELLED' :
                             'RUNNING';
            await this.prisma.test_runs.update({
              where: { id: existingRun.id },
              data: {
                status: runStatus,
                finished_at: testRun.finishedAt || testRun.endedAt || getNow()
              }
            });
            return existingRun;
          }
        }
      }

      // 如果没有找到，创建一个新的 test_runs 记录
      // 需要获取默认的 suite_id 和 trigger_user_id
      const defaultUser = await this.prisma.users.findFirst({ select: { id: true } });
      if (!defaultUser) {
        throw new Error('系统中没有可用的用户账号');
      }

      // 获取或创建默认测试套件
      let defaultSuite = await this.prisma.test_suites.findFirst({
        where: { name: '默认测试套件' }
      });

      if (!defaultSuite) {
        defaultSuite = await this.prisma.test_suites.create({
          data: {
            name: '默认测试套件',
            owner_id: defaultUser.id,
            project: null // 🔥 修复：使用 project 字段
          }
        });
      }

      const runStatus = testRun.status === 'completed' ? 'PASSED' : 
                       testRun.status === 'failed' ? 'FAILED' : 
                       testRun.status === 'cancelled' ? 'CANCELLED' :
                       'RUNNING';
      const newTestRun = await this.prisma.test_runs.create({
        data: {
          suite_id: defaultSuite.id,
          trigger_user_id: defaultUser.id,
          status: runStatus,
          started_at: testRun.startedAt ? new Date(testRun.startedAt) : getNow(),
          finished_at: testRun.finishedAt || testRun.endedAt || undefined
        }
      });

      console.log(`✅ [${testRun.id}] 创建新的 test_runs 记录 (id: ${newTestRun.id})`);
      return newTestRun;
    } catch (error) {
      console.error(`❌ [${testRun.id}] 查找或创建 test_runs 记录失败:`, error);
      throw error;
    }
  }

  /**
   * 批量同步多个 TestRun
   */
  async syncMultiple(testRuns: TestRun[]): Promise<void> {
    const promises = testRuns.map(testRun => this.syncFromTestRun(testRun));
    await Promise.allSettled(promises);
  }

  /**
   * 删除测试执行记录
   */
  async deleteExecution(id: string): Promise<boolean> {
    try {
      await this.prisma.test_case_executions.delete({
        where: { id },
      });

      console.log(`✅ [${id}] 删除测试执行记录成功`);
      return true;
    } catch (error) {
      console.error(`❌ [${id}] 删除测试执行记录失败:`, error);
      return false;
    }
  }

  /**
   * 清理旧的测试执行记录（可选）
   */
  async cleanupOldExecutions(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.test_case_executions.deleteMany({
        where: {
          queued_at: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`✅ 清理了 ${result.count} 条旧的测试执行记录`);
      return result.count;
    } catch (error) {
      console.error('❌ 清理旧的测试执行记录失败:', error);
      return 0;
    }
  }

  /**
   * 映射数据库模型到服务层数据结构
   */
  private mapToExecutionData(execution: any): TestCaseExecutionData {
    return {
      id: execution.id,
      testCaseId: execution.test_case_id,
      testCaseTitle: execution.test_case_title,
      environment: execution.environment,
      executionMode: execution.execution_mode,
      status: execution.status as TestCaseExecutionData['status'],

      executorUserId: execution.executor_user_id || undefined,
      executorDepartment: execution.executor_project || undefined,

      queuedAt: execution.queued_at,
      startedAt: execution.started_at || undefined,
      finishedAt: execution.finished_at || undefined,
      durationMs: execution.duration_ms || undefined,

      totalSteps: execution.total_steps,
      completedSteps: execution.completed_steps,
      passedSteps: execution.passed_steps,
      failedSteps: execution.failed_steps,
      progress: execution.progress,

      errorMessage: execution.error_message || undefined,

      executionLogs: execution.execution_logs || undefined,
      screenshots: execution.screenshots || undefined,
      artifacts: execution.artifacts || undefined,
      metadata: execution.metadata || undefined,
    };
  }
}

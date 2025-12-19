// 测试计划服务
import { PrismaClient } from '../../src/generated/prisma';
import type {
  TestPlan,
  CreateTestPlanInput,
  UpdateTestPlanInput,
  TestPlanCase,
  AddCasesToPlanInput,
  TestPlanExecution,
  StartTestPlanExecutionInput,
  TestPlanListQuery,
  TestPlanListResponse,
  TestPlanDetailResponse,
  TestPlanStatistics,
  TestPlanCaseResult,
} from '../../src/types/testPlan';

const prisma = new PrismaClient();

/**
 * 获取测试计划列表
 */
export async function getTestPlans(query: TestPlanListQuery): Promise<TestPlanListResponse> {
  const {
    page = 1,
    pageSize = 20,
    search,
    project,
    plan_type,
    status,
    owner_id,
    start_date,
    end_date,
  } = query;

  const skip = (page - 1) * pageSize;

  // 构建查询条件
  const where: any = {
    deleted_at: null, // 只查询未删除的记录
  };

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { short_name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (project) {
    where.project = project;
  }

  if (plan_type) {
    where.plan_type = plan_type;
  }

  if (status) {
    where.status = status;
  }

  if (owner_id) {
    where.owner_id = owner_id;
  }

  if (start_date || end_date) {
    where.start_date = {};
    if (start_date) {
      where.start_date.gte = new Date(start_date);
    }
    if (end_date) {
      where.start_date.lte = new Date(end_date);
    }
  }

  // 执行查询
  const [total, plans] = await Promise.all([
    prisma.test_plans.count({ where }),
    prisma.test_plans.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            account_name: true,
          },
        },
        _count: {
          select: {
            plan_cases: true,
            plan_executions: true,
          },
        },
      },
    }),
  ]);

  // 转换数据格式
  const data: TestPlan[] = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    short_name: plan.short_name || undefined,
    description: plan.description || undefined,
    project: plan.project || undefined,
    plan_type: plan.plan_type as any,
    status: plan.status as any,
    members: plan.members ? (plan.members as number[]) : undefined,
    owner_id: plan.owner_id,
    owner_name: plan.owner.account_name || plan.owner.username,
    start_date: plan.start_date?.toISOString(),
    end_date: plan.end_date?.toISOString(),
    created_at: plan.created_at.toISOString(),
    updated_at: plan.updated_at.toISOString(),
    total_cases: plan._count.plan_cases,
    completed_executions: plan._count.plan_executions,
  }));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取测试计划详情
 */
export async function getTestPlanDetail(planId: number): Promise<TestPlanDetailResponse> {
  const plan = await prisma.test_plans.findUnique({
    where: { id: planId },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          account_name: true,
        },
      },
      plan_cases: {
        orderBy: { sort_order: 'asc' },
      },
      plan_executions: {
        orderBy: { started_at: 'desc' },
        take: 10, // 只取最近10条执行记录
      },
    },
  });

  if (!plan) {
    throw new Error('测试计划不存在');
  }

  // 转换测试计划数据
  const planData: TestPlan = {
    id: plan.id,
    name: plan.name,
    short_name: plan.short_name || undefined,
    description: plan.description || undefined,
    project: plan.project || undefined,
    plan_type: plan.plan_type as any,
    status: plan.status as any,
    members: plan.members ? (plan.members as number[]) : undefined,
    owner_id: plan.owner_id,
    owner_name: plan.owner.account_name || plan.owner.username,
    start_date: plan.start_date?.toISOString(),
    end_date: plan.end_date?.toISOString(),
    created_at: plan.created_at.toISOString(),
    updated_at: plan.updated_at.toISOString(),
  };

  // 转换用例数据
  const cases: TestPlanCase[] = plan.plan_cases.map((c) => ({
    id: c.id,
    plan_id: c.plan_id,
    case_id: c.case_id,
    case_type: c.case_type as any,
    case_name: c.case_name,
    sort_order: c.sort_order,
    is_executed: c.is_executed,
    execution_result: c.execution_result as any,
    created_at: c.created_at.toISOString(),
  }));

  // 转换执行记录数据
  const executions: TestPlanExecution[] = plan.plan_executions.map((e) => ({
    id: e.id,
    plan_id: e.plan_id,
    plan_name: e.plan_name,
    executor_id: e.executor_id,
    executor_name: e.executor_name,
    execution_type: e.execution_type as any,
    status: e.status as any,
    progress: e.progress,
    total_cases: e.total_cases,
    completed_cases: e.completed_cases,
    passed_cases: e.passed_cases,
    failed_cases: e.failed_cases,
    blocked_cases: e.blocked_cases,
    skipped_cases: e.skipped_cases,
    started_at: e.started_at.toISOString(),
    finished_at: e.finished_at?.toISOString(),
    duration_ms: e.duration_ms || undefined,
    execution_results: e.execution_results as any,
    error_message: e.error_message || undefined,
    metadata: e.metadata as any,
  }));

  // 计算统计信息
  const statistics: TestPlanStatistics = {
    total_cases: cases.length,
    functional_cases: cases.filter((c) => c.case_type === 'functional').length,
    ui_auto_cases: cases.filter((c) => c.case_type === 'ui_auto').length,
    executed_cases: cases.filter((c) => c.is_executed).length,
    passed_cases: cases.filter((c) => c.execution_result === 'pass').length,
    failed_cases: cases.filter((c) => c.execution_result === 'fail').length,
    blocked_cases: cases.filter((c) => c.execution_result === 'block').length,
    skipped_cases: cases.filter((c) => c.execution_result === 'skip').length,
    pass_rate: 0,
    execution_rate: 0,
    total_executions: executions.length,
    latest_execution: executions[0],
  };

  if (statistics.executed_cases > 0) {
    statistics.pass_rate = (statistics.passed_cases / statistics.executed_cases) * 100;
  }

  if (statistics.total_cases > 0) {
    statistics.execution_rate = (statistics.executed_cases / statistics.total_cases) * 100;
  }

  return {
    plan: planData,
    cases,
    executions,
    statistics,
  };
}

/**
 * 创建测试计划
 */
export async function createTestPlan(input: CreateTestPlanInput): Promise<TestPlan> {
  const plan = await prisma.test_plans.create({
    data: {
      name: input.name,
      short_name: input.short_name,
      description: input.description,
      project: input.project,
      plan_type: input.plan_type,
      status: input.status || 'draft',
      members: input.members || [],
      owner_id: input.owner_id,
      start_date: input.start_date ? new Date(input.start_date) : null,
      end_date: input.end_date ? new Date(input.end_date) : null,
    },
    include: {
      owner: {
        select: {
          username: true,
          account_name: true,
        },
      },
    },
  });

  return {
    id: plan.id,
    name: plan.name,
    short_name: plan.short_name || undefined,
    description: plan.description || undefined,
    project: plan.project || undefined,
    plan_type: plan.plan_type as any,
    status: plan.status as any,
    members: plan.members as number[],
    owner_id: plan.owner_id,
    owner_name: plan.owner.account_name || plan.owner.username,
    start_date: plan.start_date?.toISOString(),
    end_date: plan.end_date?.toISOString(),
    created_at: plan.created_at.toISOString(),
    updated_at: plan.updated_at.toISOString(),
  };
}

/**
 * 更新测试计划
 */
export async function updateTestPlan(planId: number, input: UpdateTestPlanInput): Promise<TestPlan> {
  const data: any = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.short_name !== undefined) data.short_name = input.short_name;
  if (input.description !== undefined) data.description = input.description;
  if (input.project !== undefined) data.project = input.project;
  if (input.plan_type !== undefined) data.plan_type = input.plan_type;
  if (input.status !== undefined) data.status = input.status;
  if (input.members !== undefined) data.members = input.members;
  if (input.owner_id !== undefined) data.owner_id = input.owner_id;
  if (input.start_date !== undefined) data.start_date = input.start_date ? new Date(input.start_date) : null;
  if (input.end_date !== undefined) data.end_date = input.end_date ? new Date(input.end_date) : null;

  const plan = await prisma.test_plans.update({
    where: { id: planId },
    data,
    include: {
      owner: {
        select: {
          username: true,
          account_name: true,
        },
      },
    },
  });

  return {
    id: plan.id,
    name: plan.name,
    short_name: plan.short_name || undefined,
    description: plan.description || undefined,
    project: plan.project || undefined,
    plan_type: plan.plan_type as any,
    status: plan.status as any,
    members: plan.members as number[],
    owner_id: plan.owner_id,
    owner_name: plan.owner.account_name || plan.owner.username,
    start_date: plan.start_date?.toISOString(),
    end_date: plan.end_date?.toISOString(),
    created_at: plan.created_at.toISOString(),
    updated_at: plan.updated_at.toISOString(),
  };
}

/**
 * 删除测试计划（软删除）
 */
export async function deleteTestPlan(planId: number): Promise<void> {
  await prisma.test_plans.update({
    where: { id: planId },
    data: {
      deleted_at: new Date(),
    },
  });
}

/**
 * 添加用例到测试计划
 */
export async function addCasesToPlan(input: AddCasesToPlanInput): Promise<TestPlanCase[]> {
  const { plan_id, cases } = input;

  // 获取当前最大排序号
  const maxSortOrder = await prisma.test_plan_cases.findFirst({
    where: { plan_id },
    orderBy: { sort_order: 'desc' },
    select: { sort_order: true },
  });

  let currentSortOrder = maxSortOrder?.sort_order || 0;

  // 批量创建用例关联
  const createdCases = await Promise.all(
    cases.map(async (c, index) => {
      // 检查是否已存在
      const existing = await prisma.test_plan_cases.findFirst({
        where: {
          plan_id,
          case_id: c.case_id,
          case_type: c.case_type,
        },
      });

      if (existing) {
        return existing;
      }

      return prisma.test_plan_cases.create({
        data: {
          plan_id,
          case_id: c.case_id,
          case_type: c.case_type,
          case_name: c.case_name,
          sort_order: ++currentSortOrder,
        },
      });
    })
  );

  return createdCases.map((c) => ({
    id: c.id,
    plan_id: c.plan_id,
    case_id: c.case_id,
    case_type: c.case_type as any,
    case_name: c.case_name,
    sort_order: c.sort_order,
    is_executed: c.is_executed,
    execution_result: c.execution_result as any,
    created_at: c.created_at.toISOString(),
  }));
}

/**
 * 从测试计划中移除用例
 */
export async function removeCaseFromPlan(planId: number, caseId: number, caseType: string): Promise<void> {
  await prisma.test_plan_cases.deleteMany({
    where: {
      plan_id: planId,
      case_id: caseId,
      case_type: caseType,
    },
  });
}

/**
 * 开始执行测试计划
 */
export async function startTestPlanExecution(input: StartTestPlanExecutionInput): Promise<TestPlanExecution> {
  const { plan_id, executor_id, execution_type, case_ids } = input;

  // 获取测试计划信息
  const plan = await prisma.test_plans.findUnique({
    where: { id: plan_id },
    include: {
      owner: {
        select: {
          username: true,
          account_name: true,
        },
      },
    },
  });

  if (!plan) {
    throw new Error('测试计划不存在');
  }

  // 获取执行者信息
  const executor = await prisma.users.findUnique({
    where: { id: executor_id },
    select: {
      username: true,
      account_name: true,
    },
  });

  if (!executor) {
    throw new Error('执行者不存在');
  }

  // 获取要执行的用例列表
  const where: any = {
    plan_id,
    case_type: execution_type,
  };

  if (case_ids && case_ids.length > 0) {
    where.case_id = { in: case_ids };
  }

  const cases = await prisma.test_plan_cases.findMany({
    where,
    orderBy: { sort_order: 'asc' },
  });

  if (cases.length === 0) {
    throw new Error('没有找到要执行的用例');
  }

  // 创建执行记录
  const execution = await prisma.test_plan_executions.create({
    data: {
      plan_id,
      plan_name: plan.name,
      executor_id,
      executor_name: executor.account_name || executor.username,
      execution_type,
      status: 'queued',
      progress: 0,
      total_cases: cases.length,
      completed_cases: 0,
      passed_cases: 0,
      failed_cases: 0,
      blocked_cases: 0,
      skipped_cases: 0,
      execution_results: [],
    },
  });

  return {
    id: execution.id,
    plan_id: execution.plan_id,
    plan_name: execution.plan_name,
    executor_id: execution.executor_id,
    executor_name: execution.executor_name,
    execution_type: execution.execution_type as any,
    status: execution.status as any,
    progress: execution.progress,
    total_cases: execution.total_cases,
    completed_cases: execution.completed_cases,
    passed_cases: execution.passed_cases,
    failed_cases: execution.failed_cases,
    blocked_cases: execution.blocked_cases,
    skipped_cases: execution.skipped_cases,
    started_at: execution.started_at.toISOString(),
    execution_results: execution.execution_results as any,
  };
}

/**
 * 更新测试计划执行状态
 */
export async function updateTestPlanExecution(
  executionId: string,
  update: {
    status?: string;
    progress?: number;
    completed_cases?: number;
    passed_cases?: number;
    failed_cases?: number;
    blocked_cases?: number;
    skipped_cases?: number;
    execution_results?: TestPlanCaseResult[];
    error_message?: string;
    finished_at?: Date;
    duration_ms?: number;
  }
): Promise<TestPlanExecution> {
  const data: any = {};

  if (update.status !== undefined) data.status = update.status;
  if (update.progress !== undefined) data.progress = update.progress;
  if (update.completed_cases !== undefined) data.completed_cases = update.completed_cases;
  if (update.passed_cases !== undefined) data.passed_cases = update.passed_cases;
  if (update.failed_cases !== undefined) data.failed_cases = update.failed_cases;
  if (update.blocked_cases !== undefined) data.blocked_cases = update.blocked_cases;
  if (update.skipped_cases !== undefined) data.skipped_cases = update.skipped_cases;
  if (update.execution_results !== undefined) data.execution_results = update.execution_results;
  if (update.error_message !== undefined) data.error_message = update.error_message;
  if (update.finished_at !== undefined) data.finished_at = update.finished_at;
  if (update.duration_ms !== undefined) data.duration_ms = update.duration_ms;

  const execution = await prisma.test_plan_executions.update({
    where: { id: executionId },
    data,
  });

  return {
    id: execution.id,
    plan_id: execution.plan_id,
    plan_name: execution.plan_name,
    executor_id: execution.executor_id,
    executor_name: execution.executor_name,
    execution_type: execution.execution_type as any,
    status: execution.status as any,
    progress: execution.progress,
    total_cases: execution.total_cases,
    completed_cases: execution.completed_cases,
    passed_cases: execution.passed_cases,
    failed_cases: execution.failed_cases,
    blocked_cases: execution.blocked_cases,
    skipped_cases: execution.skipped_cases,
    started_at: execution.started_at.toISOString(),
    finished_at: execution.finished_at?.toISOString(),
    duration_ms: execution.duration_ms || undefined,
    execution_results: execution.execution_results as any,
    error_message: execution.error_message || undefined,
    metadata: execution.metadata as any,
  };
}

/**
 * 更新测试计划用例执行状态
 */
export async function updateTestPlanCaseStatus(
  planId: number,
  caseId: number,
  caseType: string,
  result: string
): Promise<void> {
  await prisma.test_plan_cases.updateMany({
    where: {
      plan_id: planId,
      case_id: caseId,
      case_type: caseType,
    },
    data: {
      is_executed: true,
      execution_result: result,
    },
  });
}

/**
 * 获取测试计划执行记录的详细信息（包含每个用例的执行日志）
 */
export async function getTestPlanExecutionDetail(executionId: string): Promise<TestPlanExecution> {
  const execution = await prisma.test_plan_executions.findUnique({
    where: { id: executionId },
  });

  if (!execution) {
    throw new Error('执行记录不存在');
  }

  // 获取execution_results中的所有用例ID和execution_id
  const executionResults = (execution.execution_results as TestPlanCaseResult[]) || [];
  
  // 为每个用例获取详细的执行日志
  const resultsWithLogs = await Promise.all(
    executionResults.map(async (result) => {
      if (!result.execution_id) {
        return result;
      }

      // 获取功能测试用例的执行记录
      try {
        const executionRecord = await prisma.functional_test_execution_results.findUnique({
          where: { execution_id: result.execution_id },
        });

        if (executionRecord) {
          return {
            ...result,
            actualResult: executionRecord.actual_result || undefined,
            comments: executionRecord.comments || undefined,
            screenshots: executionRecord.screenshots || undefined,
            attachments: executionRecord.attachments || undefined,
            stepResults: executionRecord.step_results || undefined,
            totalSteps: executionRecord.total_steps || undefined,
            completedSteps: executionRecord.completed_steps || undefined,
            passedSteps: executionRecord.passed_steps || undefined,
            failedSteps: executionRecord.failed_steps || undefined,
            blockedSteps: executionRecord.blocked_steps || undefined,
          };
        }
      } catch (error) {
        console.error(`获取用例 ${result.case_id} 的执行记录失败:`, error);
      }

      return result;
    })
  );

  return {
    id: execution.id,
    plan_id: execution.plan_id,
    plan_name: execution.plan_name,
    executor_id: execution.executor_id,
    executor_name: execution.executor_name,
    execution_type: execution.execution_type as any,
    status: execution.status as any,
    progress: execution.progress,
    total_cases: execution.total_cases,
    completed_cases: execution.completed_cases,
    passed_cases: execution.passed_cases,
    failed_cases: execution.failed_cases,
    blocked_cases: execution.blocked_cases,
    skipped_cases: execution.skipped_cases,
    started_at: execution.started_at.toISOString(),
    finished_at: execution.finished_at?.toISOString(),
    duration_ms: execution.duration_ms || undefined,
    execution_results: resultsWithLogs,
    error_message: execution.error_message || undefined,
    metadata: execution.metadata as any,
  };
}

export default {
  getTestPlans,
  getTestPlanDetail,
  createTestPlan,
  updateTestPlan,
  deleteTestPlan,
  addCasesToPlan,
  removeCaseFromPlan,
  startTestPlanExecution,
  updateTestPlanExecution,
  updateTestPlanCaseStatus,
  getTestPlanExecutionDetail,
};


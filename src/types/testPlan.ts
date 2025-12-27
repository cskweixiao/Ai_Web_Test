// 测试计划模块类型定义

/**
 * 测试计划状态
 * - draft: 草稿
 * - not_started: 未开始（一个用例都没执行）
 * - active: 进行中（还有用例未执行完成）
 * - completed: 已完成（所有用例都已执行）
 * - expired: 已结束（计划时间已到期但未完成）
 * - cancelled: 已取消
 * - archived: 已归档（手动归档）
 */
export type TestPlanStatus = 'draft' | 'not_started' | 'active' | 'completed' | 'expired' | 'cancelled' | 'archived';

/**
 * 测试计划类型
 */
export type TestPlanType = 'functional' | 'ui_auto' | 'mixed' | 'regression' | 'smoke' | 'integration';

/**
 * 用例类型
 */
export type TestCaseType = 'functional' | 'ui_auto';

/**
 * 执行结果
 */
export type ExecutionResult = 'pass' | 'fail' | 'block' | 'skip';

/**
 * 执行状态
 */
export type ExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 测试计划接口
 */
export interface TestPlan {
  id: number;
  name: string;
  short_name?: string;
  description?: string;
  project?: string;
  plan_type: TestPlanType;
  status: TestPlanStatus;
  members?: number[]; // 成员用户ID列表
  owner_id: number;
  owner_name?: string; // 主负责人姓名（查询时填充）
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // 关联数据（查询时可能包含）
  plan_cases?: TestPlanCase[];
  plan_executions?: TestPlanExecution[];
  
  // 统计信息（查询时可能包含）
  total_cases?: number;
  functional_cases?: number;
  ui_auto_cases?: number;
  completed_executions?: number;
  // 最新执行记录的进度数据
  latest_execution_progress?: number; // 进度百分比
  latest_execution_completed_cases?: number; // 已完成用例数
  latest_execution_total_cases?: number; // 总用例数（来自执行记录）
  latest_execution_passed_cases?: number; // 通过用例数（来自最新执行记录）
  latest_execution_failed_cases?: number; // 失败用例数（来自最新执行记录）
  latest_execution_blocked_cases?: number; // 阻塞用例数（来自最新执行记录）
  latest_execution_status?: ExecutionStatus; // 最新执行状态
}

/**
 * 创建测试计划输入
 */
export interface CreateTestPlanInput {
  name: string;
  short_name?: string;
  description?: string;
  project?: string;
  plan_type: TestPlanType;
  status?: TestPlanStatus;
  members?: number[];
  owner_id: number;
  start_date?: string;
  end_date?: string;
}

/**
 * 更新测试计划输入
 */
export interface UpdateTestPlanInput {
  name?: string;
  short_name?: string;
  description?: string;
  project?: string;
  plan_type?: TestPlanType;
  status?: TestPlanStatus;
  members?: number[];
  owner_id?: number;
  start_date?: string;
  end_date?: string;
}

/**
 * 测试计划用例关联
 */
export interface TestPlanCase {
  id: number;
  plan_id: number;
  case_id: number;
  case_type: TestCaseType;
  case_name: string;
  sort_order: number;
  created_by: string;
  is_executed: boolean;
  execution_result?: ExecutionResult;
  created_at: string;
  
  // 扩展信息（查询时可能包含）
  case_detail?: unknown; // 用例详细信息
}

/**
 * 添加用例到计划输入
 */
export interface AddCasesToPlanInput {
  plan_id: number;
  cases: {
    case_id: number;
    case_type: TestCaseType;
    case_name: string;
  }[];
}

/**
 * 测试计划执行记录
 */
export interface TestPlanExecution {
  id: string;
  plan_id: number;
  plan_name: string;
  executor_id: number;
  executor_name: string;
  execution_type: TestCaseType;
  status: ExecutionStatus;
  progress: number;
  
  // 统计信息
  total_cases: number;
  completed_cases: number;
  passed_cases: number;
  failed_cases: number;
  blocked_cases: number;
  skipped_cases: number;
  
  // 时间信息
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  
  // 执行详情
  execution_results?: TestPlanCaseResult[];
  error_message?: string;
  metadata?: unknown;
}

/**
 * 测试计划用例执行结果
 */
export interface TestPlanCaseResult {
  case_id: number;
  case_name: string;
  case_type: TestCaseType;
  result: ExecutionResult;
  duration_ms?: number;
  error_message?: string;
  execution_id?: string; // 关联的具体执行记录ID
  executed_at?: string;
  
  // 执行人信息
  executor_id?: number;
  executor_name?: string;
  
  // 时间信息
  started_at?: string;
  finished_at?: string;
  
  // 详细执行日志（从功能测试执行记录中获取）
  actualResult?: string;
  comments?: string;
  screenshots?: Array<{
    fileName?: string;
    filename?: string;
    fileSize?: number;
    mimeType?: string;
    base64Data?: string;
    uploadedAt?: string;
  }>;
  attachments?: unknown[];
  stepResults?: unknown[];
  totalSteps?: number;
  completedSteps?: number;
  passedSteps?: number;
  failedSteps?: number;
  blockedSteps?: number;
  
  // 🔥 新增：执行状态
  execution_status?: 'running' | 'completed' | 'failed' | 'cancelled' | 'error' | 'queued';
}

/**
 * 执行配置
 */
export interface ExecutionConfig {
  executionEngine?: 'mcp' | 'playwright';
  enableTrace?: boolean;
  enableVideo?: boolean;
  environment?: string;
}

/**
 * 开始执行测试计划输入
 */
export interface StartTestPlanExecutionInput {
  plan_id: number;
  executor_id: number;
  execution_type: TestCaseType; // 执行哪种类型的用例
  case_ids?: number[]; // 可选：指定执行哪些用例，不指定则执行所有
  autoExecute?: boolean; // 是否自动执行，默认 true（批量执行时），false（单个用例执行时）
  executionConfig?: ExecutionConfig; // 执行配置（环境、引擎、trace、video等）
}

/**
 * 测试计划列表查询参数
 */
export interface TestPlanListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  project?: string;
  plan_type?: TestPlanType;
  status?: TestPlanStatus;
  result?: ExecutionResult;
  owner_id?: number;
  start_date?: string;
  end_date?: string;
}

/**
 * 测试计划列表响应
 */
export interface TestPlanListResponse {
  data: TestPlan[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 测试计划详情响应
 */
export interface TestPlanDetailResponse {
  plan: TestPlan;
  cases: TestPlanCase[];
  executions: TestPlanExecution[];
  statistics: TestPlanStatistics;
}

/**
 * 测试计划统计信息
 */
export interface TestPlanStatistics {
  total_cases: number;
  functional_cases: number;
  ui_auto_cases: number;
  executed_cases: number;
  passed_cases: number;
  failed_cases: number;
  blocked_cases: number;
  skipped_cases: number;
  pass_rate: number;
  execution_rate: number;
  total_executions: number;
  latest_execution?: TestPlanExecution;
}


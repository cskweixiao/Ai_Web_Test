// 测试用例基础接口
export interface TestCase {
  id: number;
  name: string;
  description?: string;
  steps: string;
  assertions?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'active' | 'draft' | 'disabled';
  tags?: string[];
  system?: string;    // 新增系统字段
  module?: string;    // 新增模块字段
  author?: string;
  created?: string;
  lastRun?: string;
  success_rate?: number;
  suiteId?: number; // 🔥 新增：关联的测试套件ID
}

// 用于显示的简化测试用例接口（兼容现有数据）
export interface TestCaseDisplay {
  id: number;
  name: string;
  description: string;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'draft' | 'disabled';
  lastRun: string;
  success_rate: number;
  author: string;
  created: string;
}

// 测试步骤接口 - 支持多种操作类型
export interface TestStep {
  id: string;
  action: TestAction;
  selector?: string;
  url?: string;
  value?: string;
  text?: string;
  condition?: ExpectCondition;
  timeout?: number;
  description: string;
  order: number;
}

export type TestAction = 
  | 'navigate'
  | 'click' 
  | 'fill'
  | 'expect'
  | 'wait'
  | 'screenshot'
  | 'hover'
  | 'drag'
  | 'select'
  | 'upload'
  | 'press_key'
  | 'tab_new'
  | 'tab_close'
  | 'tab_select'
  | 'back'
  | 'forward'
  | 'pdf_save'
  | 'wait_for_text'
  | 'scroll';

export type ExpectCondition = 
  | 'visible'
  | 'hidden'
  | 'contains_text'
  | 'not_contains_text'
  | 'has_value'
  | 'has_attribute'
  | 'is_enabled'
  | 'is_disabled'
  | 'url_changed'
  | 'logged_in'
  | 'element_exists';

// 测试执行结果
export interface TestRun {
  id:string;
  runId: string;
  testCaseId: number;
  status: TestRunStatus;
  logs: TestLog[];
  startedAt: Date;
  environment: string;
  suiteId?: string;
  reuseBrowser?: boolean;
  contextState?: any;
  executionMode?: string;
  steps: TestStep[];
  successfulSteps: string[];
  error?: string;
  endedAt?: Date;
}

export type TestRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'error' | 'cancelled';

export interface TestLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  stepId?: string;
}

export interface Screenshot {
  id: string;
  stepId: string;
  filename: string;
  timestamp: Date;
  description?: string;
}

// API 请求/响应接口
export interface RunTestRequest {
  testCaseId: number;
  environment?: string;
}

export interface RunTestResponse {
  success: boolean;
  runId: string;
  message?: string;
  error?: string;
}

// MCP 执行结果
export interface McpExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  screenshot?: string;
}

// WebSocket 消息
export interface WebSocketMessage {
  type: 'test_update' | 'test_complete' | 'test_error' | 'log';
  runId: string;
  data: any;
} 

// 🔥 新增：测试套件接口
export interface TestSuite {
  id: number;
  name: string;
  description?: string;
  owner?: string;
  tags?: string[];
  testCaseIds: number[];
  createdAt: string;
  updatedAt: string;
  environment?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'active' | 'draft' | 'disabled';
}

// 🔥 新增：测试套件运行记录
export interface TestSuiteRun {
  id: string;
  suiteId: number;
  suiteName: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: string;
  endTime?: string;
  duration: string;
  totalCases: number;
  completedCases: number;
  passedCases: number;
  failedCases: number;
  executor: string;
  environment: string;
  testRuns: string[]; // runIds of individual test cases
  error?: string;
}

// 🔥 新增：套件执行选项
export interface SuiteExecutionOptions {
  environment?: string;
  executionMode?: 'standard' | 'interactive';
  concurrency?: number;
  continueOnFailure?: boolean;
} 
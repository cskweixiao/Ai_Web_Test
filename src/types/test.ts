// 测试用例基础接口
export interface TestCase {
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
  steps: TestStep[];
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
  | 'select'
  | 'upload';

export type ExpectCondition = 
  | 'visible'
  | 'hidden'
  | 'contains_text'
  | 'has_value'
  | 'has_attribute';

// 测试执行结果
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
  screenshots: Screenshot[];
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
import type { TestCase, TestRun, RunTestRequest, RunTestResponse, WebSocketMessage, TestSuite, TestSuiteRun } from '../types/test';

const API_BASE_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';

export class TestService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, (message: WebSocketMessage) => void> = new Map();

  // 初始化 WebSocket 连接
  initializeWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);
        
        this.ws.onopen = () => {
          console.log('🔌 WebSocket 连接已建立');
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.notifyListeners(message);
          } catch (error) {
            console.error('WebSocket 消息解析错误:', error);
          }
        };
        
        this.ws.onclose = () => {
          console.log('❌ WebSocket 连接已关闭');
          // 自动重连
          setTimeout(() => {
            this.initializeWebSocket();
          }, 3000);
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket 错误:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // 添加消息监听器
  addMessageListener(id: string, callback: (message: WebSocketMessage) => void): void {
    this.listeners.set(id, callback);
  }

  // 移除消息监听器
  removeMessageListener(id: string): void {
    this.listeners.delete(id);
  }

  // 通知所有监听器
  private notifyListeners(message: WebSocketMessage): void {
    this.listeners.forEach(callback => {
      callback(message);
    });
  }

  // 获取所有测试用例
  async getTestCases(): Promise<TestCase[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/tests/cases`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '获取测试用例失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('获取测试用例失败:', error);
      throw error;
    }
  }

  // 创建测试用例
  async createTestCase(caseData: Partial<TestCase>): Promise<TestCase> {
    try {
      const response = await fetch(`${API_BASE_URL}/tests/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '创建测试用例失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('创建测试用例失败:', error);
      throw error;
    }
  }

  // 更新测试用例
  async updateTestCase(id: number, caseData: Partial<TestCase>): Promise<TestCase> {
    try {
      const response = await fetch(`${API_BASE_URL}/tests/cases/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '更新测试用例失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('更新测试用例失败:', error);
      throw error;
    }
  }

  // 删除测试用例
  async deleteTestCase(id: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/tests/cases/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '删除测试用例失败');
      }
    } catch (error) {
      console.error('删除测试用例失败:', error);
      throw error;
    }
  }

  // 运行单个测试用例
  async runTestCase(caseId: number): Promise<{runId: string}> {
    try {
      const response = await fetch(`${API_BASE_URL}/tests/cases/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ caseId })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '执行测试用例失败');
      }
      
      return { runId: data.runId };
    } catch (error) {
      console.error('执行测试用例失败:', error);
      throw error;
    }
  }

  // 执行测试用例
  async runTest(request: RunTestRequest): Promise<RunTestResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/tests/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '执行测试失败');
      }
      
      return data;
    } catch (error) {
      console.error('执行测试失败:', error);
      throw error;
    }
  }

  // 获取测试运行状态
  async getTestRun(runId: string): Promise<TestRun> {
    try {
      const response = await fetch(`${API_BASE_URL}/tests/runs/${runId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '获取测试运行状态失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('获取测试运行状态失败:', error);
      throw error;
    }
  }

  // 获取所有测试运行
  async getAllTestRuns(): Promise<TestRun[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/tests/runs`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '获取测试运行列表失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('获取测试运行列表失败:', error);
      throw error;
    }
  }

  // 取消测试
  async cancelTest(runId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/tests/runs/${runId}/cancel`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '取消测试失败');
      }
    } catch (error) {
      console.error('取消测试失败:', error);
      throw error;
    }
  }

  // 获取所有测试套件
  async getTestSuites(): Promise<TestSuite[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/suites`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '获取测试套件失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('获取测试套件失败:', error);
      throw error;
    }
  }
  
  // 创建测试套件
  async createTestSuite(suiteData: Partial<TestSuite>): Promise<TestSuite> {
    try {
      const response = await fetch(`${API_BASE_URL}/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(suiteData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '创建测试套件失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('创建测试套件失败:', error);
      throw error;
    }
  }

  // 更新测试套件
  async updateTestSuite(id: number, suiteData: Partial<TestSuite>): Promise<TestSuite> {
    try {
      const response = await fetch(`${API_BASE_URL}/suites/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(suiteData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '更新测试套件失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('更新测试套件失败:', error);
      throw error;
    }
  }

  // 删除测试套件
  async deleteTestSuite(id: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/suites/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '删除测试套件失败');
      }
    } catch (error) {
      console.error('删除测试套件失败:', error);
      throw error;
    }
  }

  // 执行测试套件
  async runTestSuite(suiteId: number, options: { 
    environment?: string;
    executionMode?: 'standard' | 'interactive';
    concurrency?: number;
    continueOnFailure?: boolean;
  } = {}): Promise<{runId: string}> {
    try {
      const response = await fetch(`${API_BASE_URL}/suites/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suiteId,
          ...options
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '执行测试套件失败');
      }
      
      return { runId: data.runId };
    } catch (error) {
      console.error('执行测试套件失败:', error);
      throw error;
    }
  }

  // 获取测试套件运行状态
  async getSuiteRun(suiteRunId: string): Promise<TestSuiteRun> {
    try {
      const response = await fetch(`${API_BASE_URL}/suites/runs/${suiteRunId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '获取测试套件运行状态失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('获取测试套件运行状态失败:', error);
      throw error;
    }
  }

  // 获取所有测试套件运行
  async getAllSuiteRuns(): Promise<TestSuiteRun[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/suites/runs`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '获取测试套件运行列表失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('获取测试套件运行列表失败:', error);
      throw error;
    }
  }

  // 取消测试套件运行
  async cancelSuiteRun(suiteRunId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/suites/runs/${suiteRunId}/cancel`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '取消测试套件运行失败');
      }
    } catch (error) {
      console.error('取消测试套件运行失败:', error);
      throw error;
    }
  }

  // 关闭 WebSocket 连接
  closeWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// 单例模式
export const testService = new TestService(); 
import type { TestCase, TestRun, RunTestRequest, RunTestResponse, TestSuite, TestSuiteRun } from '../types/test';

// 🔥 扩展WebSocket消息类型
export interface WebSocketMessage {
  type: 'test_update' | 'test_complete' | 'test_error' | 'log' | 'suiteUpdate';
  runId?: string;
  suiteRunId?: string;
  data?: any;
  suiteRun?: any;
}

const API_BASE_URL = `http://${window.location.hostname}:3001/api`;
const WS_URL = `ws://${window.location.hostname}:3001`;

export class TestService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, (message: WebSocketMessage) => void> = new Map();

  // 初始化 WebSocket 连接
  initializeWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 如果已有连接且开着，不需要重新连接
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('🔌 WebSocket 已连接，无需重连');
          resolve();
          return;
        }
        
        // 关闭旧连接
        if (this.ws) {
          try {
            console.log('🔌 关闭旧的 WebSocket 连接');
            this.ws.close();
          } catch (e) {
            console.log('关闭旧WebSocket连接时出错，忽略:', e);
          }
          this.ws = null;
        }
        
        console.log('🔌 正在创建新的 WebSocket 连接...');
        
        // 创建重连计数器，避免无限重试
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;
        let reconnectTimeout: any = null;
        
        const connectWebSocket = () => {
          try {
            if (reconnectAttempts >= maxReconnectAttempts) {
              console.error(`🔌 达到最大重连次数(${maxReconnectAttempts})，放弃重连`);
              reject(new Error('达到最大重连次数'));
              return;
            }
            
            reconnectAttempts++;
            console.log(`🔌 WebSocket连接尝试 ${reconnectAttempts}/${maxReconnectAttempts}...`);
            
            this.ws = new WebSocket(WS_URL);
            
            this.ws.onopen = () => {
              console.log('🔌 WebSocket 连接已建立');
              reconnectAttempts = 0; // 重置重连计数
              
              // 设置心跳检测
              this.setupHeartbeat();
              resolve();
            };
            
            this.ws.onmessage = (event) => {
              try {
                // 处理心跳响应
                if (event.data === 'pong') {
                  console.log('💓 收到服务器心跳响应');
                  return;
                }
                
                // 尝试解析JSON消息
                let message;
                try {
                  message = JSON.parse(event.data);
                } catch (parseError) {
                  console.warn('WebSocket消息解析失败，收到非JSON数据:', event.data);
                  return;
                }
                
                // 通知监听器
                this.notifyListeners(message);
              } catch (error) {
                console.error('WebSocket 消息处理错误:', error);
              }
            };
            
            this.ws.onclose = (event) => {
              console.log(`❌ WebSocket 连接已关闭 (code=${event.code}, reason=${event.reason})`);
              
              // 清除心跳
              this.clearHeartbeat();
              
              // 自动重连，但避免无限重试
              if (reconnectAttempts < maxReconnectAttempts) {
                const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
                console.log(`♻️ ${delay}ms后尝试第${reconnectAttempts + 1}次重连...`);
                
                // 清除可能存在的重连定时器
                if (reconnectTimeout) {
                  clearTimeout(reconnectTimeout);
                }
                
                reconnectTimeout = setTimeout(connectWebSocket, delay);
              } else {
                console.error('❌ 达到最大重连次数，放弃重连');
                reject(new Error('达到最大重连次数'));
              }
            };
            
            this.ws.onerror = (error) => {
              console.error('WebSocket 错误:', error);
              // 不在这里reject，让onclose处理重连
            };
          } catch (error) {
            console.error('创建WebSocket连接时出错:', error);
            reject(error);
          }
        };
        
        // 开始连接
        connectWebSocket();
      } catch (error) {
        console.error('初始化WebSocket时发生未预期的错误:', error);
        reject(error);
      }
    });
  }
  
  // 发送心跳包
  private setupHeartbeat() {
    // 清除现有心跳
    this.clearHeartbeat();
    
    // 设置新的心跳间隔 (每30秒)
    const heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('💓 发送心跳包...');
        this.ws.send(JSON.stringify({type: 'ping', timestamp: Date.now()}));
      } else {
        console.log('💔 心跳检测失败，WebSocket连接可能已断开');
        this.clearHeartbeat();
        this.initializeWebSocket().catch(error => {
          console.error('重连WebSocket失败:', error);
        });
      }
    }, 30000);
    
    // 存储心跳定时器ID
    (this as any).heartbeatIntervalId = heartbeatInterval;
  }
  
  // 清除心跳
  private clearHeartbeat() {
    if ((this as any).heartbeatIntervalId) {
      clearInterval((this as any).heartbeatIntervalId);
      (this as any).heartbeatIntervalId = null;
    }
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
    try {
      // 标准化消息格式
      const standardizedMessage = { ...message };
      
      // 处理suiteUpdate消息
      if (message.type === 'suiteUpdate') {
        // 确保data字段存在
        if (!standardizedMessage.data && standardizedMessage.suiteRun) {
          standardizedMessage.data = standardizedMessage.suiteRun;
        }
      }
      
      // 调用所有监听器
      this.listeners.forEach(callback => {
        try {
          callback(standardizedMessage);
        } catch (error) {
          console.error('WebSocket消息监听器回调错误:', error);
        }
      });
    } catch (error) {
      console.error('通知监听器时出错:', error);
    }
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

  // 新增：获取测试报告详情
  async getTestReport(runId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/${runId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '获取测试报告详情失败');
      }
      
      return data.data;
    } catch (error) {
      console.error('获取测试报告详情失败:', error);
      throw error;
    }
  }

  // 检查WebSocket是否连接
  isWebSocketConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
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
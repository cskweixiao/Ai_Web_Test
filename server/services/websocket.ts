import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface WebSocketMessage {
  type: 'test_update' | 'test_complete' | 'test_error' | 'log' | 'suiteUpdate';
  runId: string;
  data?: any;
  timestamp?: string;
  suiteRun?: any; // 添加suiteRun字段支持套件更新消息
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();

  constructor(wss: WebSocketServer) {
    super();
    this.wss = wss;
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4();
      this.clients.set(clientId, ws);
      
      console.log(`🔌 新的 WebSocket 连接: ${clientId}`);

      // 发送连接确认
      this.sendToClient(clientId, {
        type: 'connected',
        data: { clientId, timestamp: new Date() }
      });

      // 处理客户端消息
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error('WebSocket 消息解析错误:', error);
        }
      });

      // 处理连接关闭
      ws.on('close', () => {
        console.log(`❌ WebSocket 连接关闭: ${clientId}`);
        this.clients.delete(clientId);
      });

      // 处理连接错误
      ws.on('error', (error) => {
        console.error(`WebSocket 错误 (${clientId}):`, error);
        this.clients.delete(clientId);
      });
    });
  }

  private handleClientMessage(clientId: string, message: any) {
    console.log(`📨 收到客户端消息 (${clientId}):`, message);
    
    // 处理心跳请求
    if (message.type === 'ping') {
      const ws = this.clients.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send('pong');
      }
      return;
    }
    
    // 处理客户端订阅测试运行更新
    if (message.type === 'subscribe_test_run') {
      // 可以在这里实现客户端订阅特定测试运行的逻辑
    }
    
    // 🔥 处理执行测试请求
    if (message.type === 'executeTest') {
      console.log(`🚀 [WebSocket] 收到执行测试请求:`, message.data);
      this.emit('executeTest', message.data);
    }
  }

  private sendToClient(clientId: string, message: any) {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // 广播给所有连接的客户端
  public broadcast(message: WebSocketMessage) {
    try {
      // 确保消息符合预期格式
      if (!message.type) {
        console.error('尝试广播无类型的消息:', message);
        return;
      }
      
      // 序列化前添加时间戳
      const messageWithTimestamp = {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      };
      
      // 🔥 确保消息格式一致性
      if (message.type === 'suiteUpdate') {
        // 确保suiteUpdate消息有一致的字段命名
        if (!messageWithTimestamp.suiteRun && messageWithTimestamp.data) {
          messageWithTimestamp.suiteRun = messageWithTimestamp.data;
        }
      }
      
      const messageStr = JSON.stringify(messageWithTimestamp);
      let liveClientCount = 0;
      
      this.clients.forEach((ws, clientId) => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(messageStr);
            liveClientCount++;
          } else {
            // 清理已断开的连接
            console.log(`清理断开的WebSocket连接: ${clientId} (状态: ${ws.readyState})`);
            this.clients.delete(clientId);
          }
        } catch (wsError) {
          console.error(`向客户端 ${clientId} 发送消息失败:`, wsError);
          // 移除出现问题的客户端
          this.clients.delete(clientId);
        }
      });
      
      console.log(`WebSocket消息广播完成: type=${message.type}, 发送给 ${liveClientCount} 个客户端`);
    } catch (error) {
      console.error('WebSocket广播消息时出错:', error);
    }
  }

  // 发送测试更新
  public sendTestUpdate(runId: string, data: any) {
    if (!runId) {
      console.error('尝试发送测试更新，但未提供runId');
      return;
    }
    
    this.broadcast({
      type: 'test_update',
      runId,
      data: data || {}
    });
  }

  // 添加新方法：广播测试更新
  public broadcastTestUpdate(testRun: any) {
    if (!testRun || !testRun.runId) {
      console.error('尝试广播测试更新，但未提供有效的testRun对象');
      return;
    }
    
    this.broadcast({
      type: 'test_update',
      runId: testRun.runId,
      data: testRun
    });
  }

  // 添加新方法：广播日志
  public broadcastLog(runId: string, log: any) {
    if (!runId) {
      console.error('尝试广播日志，但未提供runId');
      return;
    }
    
    this.broadcast({
      type: 'log',
      runId,
      data: log
    });
  }

  // 发送测试完成
  public sendTestComplete(runId: string, data: any) {
    if (!runId) {
      console.error('尝试发送测试完成，但未提供runId');
      return;
    }
    
    this.broadcast({
      type: 'test_complete',
      runId,
      data: data || {}
    });
  }

  // 发送测试错误
  public sendTestError(runId: string, error: any) {
    this.broadcast({
      type: 'test_error',
      runId,
      data: { error }
    });
  }

  // 发送日志
  public sendTestLog(runId: string, log: any) {
    this.broadcast({
      type: 'log',
      runId,
      data: log
    });
  }

  public sendTestStatus(runId: string, status: string, data: any = {}) {
    this.broadcast({
      type: 'test_update', // Reusing 'test_update' for status changes
      runId,
      data: { ...data, status }
    });
  }

  public shutdown() {
    console.log('🔌 正在关闭所有 WebSocket 连接...');
    this.clients.forEach((ws, clientId) => {
      ws.close(1000, '服务器正在关闭');
      this.clients.delete(clientId);
    });
    this.wss.close((err) => {
      if (err) {
        console.error('关闭 WebSocket 服务器时出错:', err);
      } else {
        console.log('✅ WebSocket 服务器已成功关闭');
      }
    });
  }

  // 获取连接数
  public getConnectionCount(): number {
    return this.clients.size;
  }

  // 🔥 新增：发送消息给所有客户端（兼容旧接口）
  public sendToAll(message: string) {
    this.clients.forEach((ws, clientId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      } else {
        // 清理已断开的连接
        this.clients.delete(clientId);
      }
    });
  }
} 
import { showToast } from '../utils/toast';

// 接口定义
export interface AIBulkUpdateParams {
  system: string;
  module: string;
  tagFilter?: string[];
  priorityFilter?: string;
  changeBrief: string;
  userId?: number;
}

export interface CasePatchProposal {
  id?: number;
  session_id?: number;
  case_id: number;
  case_title?: string;
  diff_json: JsonPatch[];
  ai_rationale: string;
  side_effects?: SideEffect[];
  risk_level: 'low' | 'medium' | 'high';
  recall_reason: string;
  old_hash: string;
  new_hash?: string;
  apply_status: 'pending' | 'applied' | 'skipped' | 'conflicted';
  created_at?: Date;
  applied_at?: Date;
}

export interface JsonPatch {
  op: 'replace' | 'add' | 'remove';
  path: string;
  value?: any;
}

export interface SideEffect {
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SessionResult {
  sessionId: number;
  status: string;
  proposals: CasePatchProposal[];
  totalCases: number;
  relevantCases: number;
}

export interface ApplyResult {
  success: boolean;
  appliedCount: number;
  failedCount: number;
  results: Array<{
    proposalId: number;
    caseId: number;
    success: boolean;
    error?: string;
    newVersion?: number;
  }>;
  error?: string;
}

export interface SessionDetails {
  session: {
    id: number;
    system: string;
    module: string;
    change_brief: string;
    status: string;
    created_at: Date;
    applied_at?: Date;
    created_by_email?: string;
  };
  proposals: CasePatchProposal[];
  stats: {
    totalProposals: number;
    pendingCount: number;
    appliedCount: number;
    skippedCount: number;
    conflictedCount: number;
  };
}

/**
 * AI批量更新服务
 * 集成前端与后端AI批量更新功能
 */
export class AIBulkUpdateService {
  private baseUrl: string;
  private wsManager: WebSocket | null = null;
  private messageListeners: Map<string, (message: any) => void> = new Map();

  constructor(baseUrl: string = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * 获取用户ID (模拟)
   * 实际项目中从认证状态获取
   */
  private getCurrentUserId(): string {
    // 模拟用户ID，实际项目中从认证状态获取
    return '1';
  }

  /**
   * 通用请求方法
   */
  private async makeRequest(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'x-user-id': this.getCurrentUserId()
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || `HTTP ${response.status}`;
        } catch {
          errorMessage = `请求失败: HTTP ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || '请求处理失败');
      }

      return data.data;

    } catch (error: any) {
      console.error(`❌ API请求失败 [${endpoint}]:`, error);
      throw error;
    }
  }

  /**
   * 检查AI批量更新功能可用性
   */
  async checkFeatureAvailability(): Promise<boolean> {
    try {
      console.log('🔍 [AIBulkUpdateService] 检查功能可用性...');
      
      const result = await this.makeRequest('/features/ai-bulk-update/available');
      const available = result?.available || false;
      
      console.log('✅ [AIBulkUpdateService] 功能检查完成:', available);
      return available;
      
    } catch (error: any) {
      console.error('❌ [AIBulkUpdateService] 检查功能可用性失败:', error);
      return false;
    }
  }

  /**
   * 执行干跑，生成AI提案
   */
  async createDryRun(params: AIBulkUpdateParams): Promise<SessionResult> {
    console.log('🚀 [AIBulkUpdateService] 开始干跑，参数:', params);

    try {
      const result = await this.makeRequest('/ai-bulk/dry-run', {
        method: 'POST',
        body: JSON.stringify(params)
      });

      console.log('✅ [AIBulkUpdateService] 干跑完成:', result);

      // 转换后端数据格式到前端格式
      const sessionResult: SessionResult = {
        sessionId: result.sessionId,
        status: result.status,
        proposals: result.proposals?.map((p: any) => ({
          id: typeof p.id === 'string' ? parseInt(p.id) : p.id,
          session_id: p.session_id,
          case_id: p.case_id,
          case_title: p.case_title,
          diff_json: Array.isArray(p.diff_json) ? p.diff_json : JSON.parse(p.diff_json || '[]'),
          ai_rationale: p.ai_rationale || '',
          side_effects: Array.isArray(p.side_effects) ? p.side_effects : JSON.parse(p.side_effects || '[]'),
          risk_level: p.risk_level as 'low' | 'medium' | 'high',
          recall_reason: p.recall_reason || '',
          old_hash: p.old_hash,
          new_hash: p.new_hash,
          apply_status: p.apply_status as 'pending' | 'applied' | 'skipped' | 'conflicted',
          created_at: p.created_at ? new Date(p.created_at) : undefined,
          applied_at: p.applied_at ? new Date(p.applied_at) : undefined
        })) || [],
        totalCases: result.totalCases || 0,
        relevantCases: result.relevantCases || 0
      };

      return sessionResult;

    } catch (error: any) {
      console.error('❌ [AIBulkUpdateService] 干跑失败:', error);
      throw new Error(`AI分析失败: ${error.message}`);
    }
  }

  /**
   * 应用选中的提案
   */
  async applyProposals(sessionId: number, proposalIds: number[]): Promise<ApplyResult> {
    console.log('🔄 [AIBulkUpdateService] 开始应用提案:', { sessionId, proposalIds });

    try {
      const result = await this.makeRequest('/ai-bulk/apply', {
        method: 'POST',
        body: JSON.stringify({ 
          sessionId: sessionId,
          selectedProposals: proposalIds 
        })
      });

      console.log('✅ [AIBulkUpdateService] 应用完成:', result);

      return {
        success: result.success || false,
        appliedCount: result.appliedCount || 0,
        failedCount: result.failedCount || 0,
        results: result.results || [],
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ [AIBulkUpdateService] 应用失败:', error);
      throw new Error(`应用提案失败: ${error.message}`);
    }
  }

  /**
   * 获取会话详情
   */
  async getSessionDetails(sessionId: number): Promise<SessionDetails> {
    console.log('📋 [AIBulkUpdateService] 获取会话详情:', sessionId);

    try {
      const result = await this.makeRequest(`/ai-bulk/session/${sessionId}`);

      console.log('✅ [AIBulkUpdateService] 获取会话详情完成:', result);

      return {
        session: {
          id: result.session.id,
          system: result.session.system,
          module: result.session.module,
          change_brief: result.session.change_brief,
          status: result.session.status,
          created_at: new Date(result.session.created_at),
          applied_at: result.session.applied_at ? new Date(result.session.applied_at) : undefined,
          created_by_email: result.session.created_by_email
        },
        proposals: result.proposals?.map((p: any) => ({
          id: typeof p.id === 'string' ? parseInt(p.id) : p.id,
          session_id: p.session_id,
          case_id: p.case_id,
          case_title: p.case_title,
          diff_json: Array.isArray(p.diff_json) ? p.diff_json : JSON.parse(p.diff_json || '[]'),
          ai_rationale: p.ai_rationale || '',
          side_effects: Array.isArray(p.side_effects) ? p.side_effects : JSON.parse(p.side_effects || '[]'),
          risk_level: p.risk_level as 'low' | 'medium' | 'high',
          recall_reason: p.recall_reason || '',
          old_hash: p.old_hash,
          new_hash: p.new_hash,
          apply_status: p.apply_status as 'pending' | 'applied' | 'skipped' | 'conflicted',
          created_at: p.created_at ? new Date(p.created_at) : undefined,
          applied_at: p.applied_at ? new Date(p.applied_at) : undefined
        })) || [],
        stats: result.stats || {
          totalProposals: 0,
          pendingCount: 0,
          appliedCount: 0,
          skippedCount: 0,
          conflictedCount: 0
        }
      };

    } catch (error: any) {
      console.error('❌ [AIBulkUpdateService] 获取会话详情失败:', error);
      throw new Error(`获取会话详情失败: ${error.message}`);
    }
  }

  /**
   * 取消会话
   */
  async cancelSession(sessionId: number): Promise<void> {
    console.log('🚫 [AIBulkUpdateService] 取消会话:', sessionId);

    try {
      await this.makeRequest('/ai-bulk/cancel', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sessionId })
      });

      console.log('✅ [AIBulkUpdateService] 会话已取消:', sessionId);

    } catch (error: any) {
      console.error('❌ [AIBulkUpdateService] 取消会话失败:', error);
      throw new Error(`取消会话失败: ${error.message}`);
    }
  }

  /**
   * 初始化WebSocket连接以监听实时更新
   */
  initializeWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `ws://localhost:3001/ws?userId=${this.getCurrentUserId()}`;
        this.wsManager = new WebSocket(wsUrl);

        this.wsManager.onopen = () => {
          console.log('✅ [AIBulkUpdateService] WebSocket连接已建立');
          resolve();
        };

        this.wsManager.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📣 [AIBulkUpdateService] 收到WebSocket消息:', message);

            // 分发消息给所有监听器
            this.messageListeners.forEach((listener, id) => {
              try {
                listener(message);
              } catch (error) {
                console.error(`❌ [AIBulkUpdateService] 消息监听器 ${id} 处理失败:`, error);
              }
            });
          } catch (error) {
            console.error('❌ [AIBulkUpdateService] 解析WebSocket消息失败:', error);
          }
        };

        this.wsManager.onerror = (error) => {
          console.error('❌ [AIBulkUpdateService] WebSocket错误:', error);
          reject(error);
        };

        this.wsManager.onclose = (event) => {
          console.log('🔌 [AIBulkUpdateService] WebSocket连接已关闭:', event.code, event.reason);
          this.wsManager = null;
          
          // 自动重连（生产环境可以添加退避策略）
          if (event.code !== 1000) { // 非正常关闭
            setTimeout(() => {
              console.log('🔄 [AIBulkUpdateService] 尝试重新连接WebSocket...');
              this.initializeWebSocket().catch(console.error);
            }, 5000);
          }
        };

      } catch (error) {
        console.error('❌ [AIBulkUpdateService] 初始化WebSocket失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 添加WebSocket消息监听器
   */
  addMessageListener(id: string, listener: (message: any) => void): void {
    this.messageListeners.set(id, listener);
    console.log(`📡 [AIBulkUpdateService] 添加消息监听器: ${id}`);
  }

  /**
   * 移除WebSocket消息监听器
   */
  removeMessageListener(id: string): void {
    this.messageListeners.delete(id);
    console.log(`📡 [AIBulkUpdateService] 移除消息监听器: ${id}`);
  }

  /**
   * 检查WebSocket连接状态
   */
  isWebSocketConnected(): boolean {
    return this.wsManager?.readyState === WebSocket.OPEN;
  }

  /**
   * 关闭WebSocket连接
   */
  closeWebSocket(): void {
    if (this.wsManager) {
      this.wsManager.close(1000, '主动关闭');
      this.wsManager = null;
    }
    this.messageListeners.clear();
    console.log('🔌 [AIBulkUpdateService] WebSocket连接已关闭');
  }
}

// 创建全局实例
export const aiBulkUpdateService = new AIBulkUpdateService();
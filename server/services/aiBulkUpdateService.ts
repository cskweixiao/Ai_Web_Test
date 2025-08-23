import { PrismaClient } from '../../src/generated/prisma/index.js';
import { AITestParser } from './aiParser.js';
import { EmbeddingService, TestCaseFilters } from './embeddingService.js';
import { VersionService } from './versionService.js';
import { WebSocketManager } from './websocket.js';
import crypto from 'crypto';

// 接口定义
export interface BulkEditParams {
  system: string;
  module: string;
  tagFilter?: string[];
  priorityFilter?: string;
  changeBrief: string;
  userId: number;
}

export interface SessionResult {
  sessionId: number;
  status: string;
  proposals: CasePatchProposal[];
  totalCases: number;
  relevantCases: number;
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

export interface RelevanceResult {
  is_relevant: boolean;
  relevance_score: number;
  recall_reason: string;
}

export interface UpdateResult {
  reasoning: string;
  patch: JsonPatch[];
  side_effects: SideEffect[];
  risk_level: 'low' | 'medium' | 'high';
}

/**
 * AI批量更新服务
 * 负责协调整个批量更新流程
 */
export class AIBulkUpdateService {
  private prisma: PrismaClient;
  private aiParser: AITestParser;
  private embeddingService: EmbeddingService;
  private versionService: VersionService;
  private wsManager: WebSocketManager;

  constructor(
    prisma: PrismaClient,
    aiParser: AITestParser,
    embeddingService: EmbeddingService,
    versionService: VersionService,
    wsManager: WebSocketManager
  ) {
    this.prisma = prisma;
    this.aiParser = aiParser;
    this.embeddingService = embeddingService;
    this.versionService = versionService;
    this.wsManager = wsManager;
  }

  /**
   * 创建批量编辑会话（干跑模式）
   * 生成修改提案但不直接应用
   */
  async createBulkEditSession(params: BulkEditParams): Promise<SessionResult> {
    console.log(`🚀 [AIBulkUpdateService] 开始创建批量编辑会话...`);
    console.log(`   系统: ${params.system}`);
    console.log(`   模块: ${params.module}`);
    console.log(`   变更描述: ${params.changeBrief}`);

    try {
      // 1. 创建批量编辑会话记录
      const session = await this.prisma.bulk_edit_sessions.create({
        data: {
          system: params.system,
          module: params.module,
          tag_filter: params.tagFilter ? JSON.stringify(params.tagFilter) : null,
          priority_filter: params.priorityFilter || null,
          change_brief: params.changeBrief,
          status: 'dry_run',
          created_by: params.userId,
          created_at: new Date()
        }
      });

      console.log(`✅ [AIBulkUpdateService] 会话创建成功 (ID: ${session.id})`);

      // 2. 通过WebSocket通知开始处理
      this.wsManager.broadcast({
        type: 'bulk_update_started',
        payload: {
          sessionId: session.id,
          status: 'finding_cases'
        }
      });

      // 3. 搜索相关测试用例
      const filters: TestCaseFilters = {
        system: params.system,
        module: params.module,
        tags: params.tagFilter,
        priorityFilter: params.priorityFilter,
        changeBrief: params.changeBrief
      };

      const relevantCases = await this.embeddingService.findRelevantTestCases(filters);
      console.log(`🔍 [AIBulkUpdateService] 找到 ${relevantCases.length} 个相关用例`);

      if (relevantCases.length === 0) {
        await this.prisma.bulk_edit_sessions.update({
          where: { id: session.id },
          data: { status: 'failed' }
        });

        return {
          sessionId: session.id,
          status: 'no_cases_found',
          proposals: [],
          totalCases: 0,
          relevantCases: 0
        };
      }

      // 4. 通知开始生成AI提案
      this.wsManager.broadcast({
        type: 'bulk_update_progress',
        payload: {
          sessionId: session.id,
          status: 'generating_proposals',
          progress: 0,
          total: relevantCases.length
        }
      });

      // 5. 生成AI修改提案
      const proposals = await this.generateBulkUpdateProposals(
        session.id,
        params.changeBrief,
        relevantCases
      );

      console.log(`🤖 [AIBulkUpdateService] 生成了 ${proposals.length} 个修改提案`);

      // 6. 保存提案到数据库
      await this.savePatchProposals(session.id, proposals);

      // 7. 通知完成
      this.wsManager.broadcast({
        type: 'bulk_update_completed',
        payload: {
          sessionId: session.id,
          status: 'proposals_ready',
          proposalCount: proposals.length
        }
      });

      console.log(`✅ [AIBulkUpdateService] 批量编辑会话创建完成`);

      return {
        sessionId: session.id,
        status: 'proposals_ready',
        proposals: proposals,
        totalCases: relevantCases.length,
        relevantCases: proposals.length
      };

    } catch (error: any) {
      console.error(`❌ [AIBulkUpdateService] 创建批量编辑会话失败: ${error.message}`);
      
      this.wsManager.broadcast({
        type: 'bulk_update_error',
        payload: {
          sessionId: 0,
          error: error.message
        }
      });

      throw new Error(`创建批量编辑会话失败: ${error.message}`);
    }
  }

  /**
   * 应用选中的修改提案
   */
  async applyProposals(sessionId: number, proposalIds: number[]): Promise<ApplyResult> {
    console.log(`🔄 [AIBulkUpdateService] 开始应用提案，会话ID: ${sessionId}`);
    console.log(`   选中提案数: ${proposalIds.length}`);

    try {
      // 1. 获取选中的提案
      const proposals = await this.prisma.case_patch_proposals.findMany({
        where: {
          id: { in: proposalIds },
          session_id: sessionId,
          apply_status: 'pending'
        },
        include: {
          test_cases: {
            select: { id: true, title: true, steps: true, tags: true, system: true, module: true }
          }
        }
      });

      if (proposals.length === 0) {
        throw new Error('没有找到可应用的提案');
      }

      console.log(`📋 [AIBulkUpdateService] 找到 ${proposals.length} 个有效提案`);

      // 2. 通知开始应用
      this.wsManager.broadcast({
        type: 'bulk_apply_started',
        payload: {
          sessionId,
          totalProposals: proposals.length
        }
      });

      const results: ApplyResult['results'] = [];
      let appliedCount = 0;
      let failedCount = 0;

      // 3. 逐个应用提案
      for (let i = 0; i < proposals.length; i++) {
        const proposal = proposals[i];
        
        try {
          // 通知进度
          this.wsManager.broadcast({
            type: 'bulk_apply_progress',
            payload: {
              sessionId,
              progress: i + 1,
              total: proposals.length,
              currentCase: proposal.test_cases.title
            }
          });

          // 应用单个提案
          const result = await this.applySingleProposal(proposal);
          results.push(result);

          if (result.success) {
            appliedCount++;
          } else {
            failedCount++;
          }

        } catch (error: any) {
          console.error(`❌ [AIBulkUpdateService] 应用提案 ${proposal.id} 失败: ${error.message}`);
          
          results.push({
            proposalId: proposal.id,
            caseId: proposal.case_id,
            success: false,
            error: error.message
          });
          
          failedCount++;
        }
      }

      // 4. 更新会话状态
      await this.prisma.bulk_edit_sessions.update({
        where: { id: sessionId },
        data: {
          status: 'applied',
          applied_at: new Date()
        }
      });

      // 5. 通知完成
      this.wsManager.broadcast({
        type: 'bulk_apply_completed',
        payload: {
          sessionId,
          appliedCount,
          failedCount
        }
      });

      console.log(`✅ [AIBulkUpdateService] 批量应用完成: ${appliedCount} 成功, ${failedCount} 失败`);

      return {
        success: failedCount === 0,
        appliedCount,
        failedCount,
        results
      };

    } catch (error: any) {
      console.error(`❌ [AIBulkUpdateService] 批量应用失败: ${error.message}`);

      this.wsManager.broadcast({
        type: 'bulk_apply_error',
        payload: {
          sessionId,
          error: error.message
        }
      });

      return {
        success: false,
        appliedCount: 0,
        failedCount: proposalIds.length,
        results: [],
        error: error.message
      };
    }
  }

  /**
   * 获取会话详情
   */
  async getSessionDetails(sessionId: number): Promise<SessionDetails> {
    console.log(`📋 [AIBulkUpdateService] 获取会话详情: ${sessionId}`);

    try {
      // 获取会话信息
      const session = await this.prisma.bulk_edit_sessions.findUnique({
        where: { id: sessionId },
        include: {
          users: {
            select: { email: true }
          }
        }
      });

      if (!session) {
        throw new Error(`会话 ${sessionId} 不存在`);
      }

      // 获取提案信息
      const proposals = await this.prisma.case_patch_proposals.findMany({
        where: { session_id: sessionId },
        include: {
          test_cases: {
            select: { title: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      // 统计信息
      const stats = {
        totalProposals: proposals.length,
        pendingCount: proposals.filter(p => p.apply_status === 'pending').length,
        appliedCount: proposals.filter(p => p.apply_status === 'applied').length,
        skippedCount: proposals.filter(p => p.apply_status === 'skipped').length,
        conflictedCount: proposals.filter(p => p.apply_status === 'conflicted').length
      };

      // 转换提案数据
      const proposalData: CasePatchProposal[] = proposals.map(p => ({
        id: p.id,
        session_id: p.session_id,
        case_id: p.case_id,
        case_title: p.test_cases.title,
        diff_json: Array.isArray(p.diff_json) ? p.diff_json : [],
        ai_rationale: p.ai_rationale || '',
        side_effects: Array.isArray(p.side_effects) ? p.side_effects : [],
        risk_level: p.risk_level as 'low' | 'medium' | 'high',
        recall_reason: p.recall_reason || '',
        old_hash: p.old_hash,
        new_hash: p.new_hash,
        apply_status: p.apply_status as 'pending' | 'applied' | 'skipped' | 'conflicted',
        created_at: p.created_at,
        applied_at: p.applied_at
      }));

      return {
        session: {
          id: session.id,
          system: session.system,
          module: session.module,
          change_brief: session.change_brief,
          status: session.status,
          created_at: session.created_at!,
          applied_at: session.applied_at,
          created_by_email: session.users.email
        },
        proposals: proposalData,
        stats
      };

    } catch (error: any) {
      console.error(`❌ [AIBulkUpdateService] 获取会话详情失败: ${error.message}`);
      throw new Error(`获取会话详情失败: ${error.message}`);
    }
  }

  /**
   * 取消会话
   */
  async cancelSession(sessionId: number): Promise<void> {
    console.log(`🚫 [AIBulkUpdateService] 取消会话: ${sessionId}`);

    try {
      await this.prisma.bulk_edit_sessions.update({
        where: { id: sessionId },
        data: { status: 'cancelled' }
      });

      this.wsManager.broadcast({
        type: 'bulk_update_cancelled',
        payload: { sessionId }
      });

      console.log(`✅ [AIBulkUpdateService] 会话已取消: ${sessionId}`);

    } catch (error: any) {
      console.error(`❌ [AIBulkUpdateService] 取消会话失败: ${error.message}`);
      throw new Error(`取消会话失败: ${error.message}`);
    }
  }

  /**
   * 生成批量更新提案
   * @private
   */
  private async generateBulkUpdateProposals(
    sessionId: number,
    changeBrief: string,
    targetCases: any[]
  ): Promise<CasePatchProposal[]> {
    console.log(`🤖 [AIBulkUpdateService] 开始生成AI修改提案...`);

    const proposals: CasePatchProposal[] = [];
    let processedCount = 0;

    for (const testCase of targetCases) {
      try {
        processedCount++;
        
        // 通知进度
        this.wsManager.broadcast({
          type: 'bulk_update_progress',
          payload: {
            sessionId,
            status: 'generating_proposals',
            progress: processedCount,
            total: targetCases.length,
            currentCase: testCase.title
          }
        });

        // 1. 检查相关性
        const relevanceResult = await this.checkRelevance(changeBrief, testCase);
        if (!relevanceResult.is_relevant) {
          console.log(`⏭️ [AIBulkUpdateService] 跳过不相关用例: ${testCase.title}`);
          continue;
        }

        // 2. 生成修改提案
        const updateResult = await this.generateCaseUpdate(changeBrief, testCase);
        if (!updateResult.patch || updateResult.patch.length === 0) {
          console.log(`⏭️ [AIBulkUpdateService] 跳过无修改用例: ${testCase.title}`);
          continue;
        }

        // 3. 计算内容哈希
        const oldHash = this.versionService.calculateHash(testCase.steps);
        const newSteps = this.applyJsonPatch(testCase.steps, updateResult.patch);
        const newHash = this.versionService.calculateHash(newSteps);

        proposals.push({
          case_id: testCase.id,
          case_title: testCase.title,
          diff_json: updateResult.patch,
          ai_rationale: updateResult.reasoning,
          side_effects: updateResult.side_effects,
          risk_level: updateResult.risk_level,
          recall_reason: relevanceResult.recall_reason,
          old_hash: oldHash,
          new_hash: newHash,
          apply_status: 'pending'
        });

        console.log(`✅ [AIBulkUpdateService] 生成提案: ${testCase.title}`);

      } catch (error: any) {
        console.error(`❌ [AIBulkUpdateService] 为用例 ${testCase.id} 生成提案失败: ${error.message}`);
        continue;
      }
    }

    console.log(`🎯 [AIBulkUpdateService] 提案生成完成: ${proposals.length}/${targetCases.length}`);
    return proposals;
  }

  /**
   * 应用单个提案
   * @private
   */
  private async applySingleProposal(proposal: any): Promise<ApplyResult['results'][0]> {
    console.log(`🔧 [AIBulkUpdateService] 应用提案: 用例 ${proposal.case_id}`);

    try {
      // 1. 创建版本备份
      const version = await this.versionService.createVersion(proposal.case_id);
      
      // 2. 应用JSON Patch
      const originalSteps = proposal.test_cases.steps;
      const newSteps = this.applyJsonPatch(originalSteps, proposal.diff_json);

      // 3. 更新测试用例
      await this.prisma.test_cases.update({
        where: { id: proposal.case_id },
        data: { steps: newSteps }
      });

      // 4. 更新提案状态
      await this.prisma.case_patch_proposals.update({
        where: { id: proposal.id },
        data: {
          apply_status: 'applied',
          applied_at: new Date()
        }
      });

      console.log(`✅ [AIBulkUpdateService] 提案应用成功: 用例 ${proposal.case_id} -> v${version.version}`);

      return {
        proposalId: proposal.id,
        caseId: proposal.case_id,
        success: true,
        newVersion: version.version
      };

    } catch (error: any) {
      // 更新提案状态为冲突
      await this.prisma.case_patch_proposals.update({
        where: { id: proposal.id },
        data: { apply_status: 'conflicted' }
      });

      return {
        proposalId: proposal.id,
        caseId: proposal.case_id,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检查用例相关性 (真正的AI调用)
   * @private
   */
  private async checkRelevance(changeBrief: string, testCase: any): Promise<RelevanceResult> {
    console.log(`🔍 [AIBulkUpdateService] 使用AI检查用例相关性: ${testCase.title}`);
    
    try {
      // 使用AITestParser的真正AI相关性检查
      const aiResult = await this.aiParser.checkTestCaseRelevance(changeBrief, testCase);
      
      console.log(`✅ [AIBulkUpdateService] AI相关性检查完成: ${aiResult.is_relevant ? '相关' : '不相关'} (${Math.round(aiResult.relevance_score * 100)}%)`);
      
      return aiResult;
      
    } catch (error: any) {
      console.error(`❌ [AIBulkUpdateService] AI相关性检查失败: ${error.message}, 回退到简化模式`);
      
      // 回退到简化的关键词匹配
      const caseText = `${testCase.title} ${JSON.stringify(testCase.steps)}`.toLowerCase();
      const changeText = changeBrief.toLowerCase();
      
      const keywords = changeText.split(/\s+/).filter(w => w.length > 2);
      let matchCount = 0;
      
      for (const keyword of keywords) {
        if (caseText.includes(keyword)) {
          matchCount++;
        }
      }
      
      const relevanceScore = matchCount / Math.max(keywords.length, 1);
      const isRelevant = relevanceScore > 0.1;
      
      return {
        is_relevant: isRelevant,
        relevance_score: relevanceScore,
        recall_reason: isRelevant ? 
          `关键词匹配 ${matchCount}/${keywords.length} (回退模式)` : 
          `无关键词匹配 (回退模式)`
      };
    }
  }

  /**
   * 生成用例更新方案 (真正的AI调用)
   * @private
   */
  private async generateCaseUpdate(changeBrief: string, testCase: any): Promise<UpdateResult> {
    console.log(`🤖 [AIBulkUpdateService] 使用AI生成用例更新方案: ${testCase.title}`);
    
    try {
      // 使用AITestParser的真正AI更新生成
      const aiResult = await this.aiParser.generateTestCaseUpdate(changeBrief, testCase);
      
      console.log(`✅ [AIBulkUpdateService] AI更新方案生成完成: ${aiResult.patch.length} 个修改操作`);
      
      return aiResult;
      
    } catch (error: any) {
      console.error(`❌ [AIBulkUpdateService] AI更新方案生成失败: ${error.message}, 回退到简化模式`);
      
      // 回退到简化的模式匹配更新
      if (!testCase.steps || !Array.isArray(testCase.steps)) {
        throw new Error('测试用例步骤格式无效');
      }

      const patches: JsonPatch[] = [];
      
      // 示例：如果变更涉及"弹窗"，则修改相关步骤
      if (changeBrief.includes('弹窗') || changeBrief.includes('模态')) {
        for (let i = 0; i < testCase.steps.length; i++) {
          const step = testCase.steps[i];
          if (step.description && step.description.includes('跳转')) {
            patches.push({
              op: 'replace',
              path: `/steps/${i}/description`,
              value: step.description.replace('跳转', '显示弹窗')
            });
          }
        }
      }

      return {
        reasoning: `基于变更描述"${changeBrief}"，使用模式匹配识别并修改了相关的测试步骤 (回退模式)`,
        patch: patches,
        side_effects: patches.length > 0 ? [{
          description: '可能影响页面流转逻辑 (回退模式分析)',
          severity: 'medium' as const
        }] : [],
        risk_level: patches.length > 2 ? 'high' : patches.length > 0 ? 'medium' : 'low'
      };
    }
  }

  /**
   * 应用JSON Patch
   * @private
   */
  private applyJsonPatch(original: any, patches: JsonPatch[]): any {
    // 🔥 处理JSON字符串格式的原始数据
    let result: any;
    if (typeof original === 'string') {
      try {
        result = JSON.parse(original);
        console.log(`🔧 [AIBulkUpdateService] 解析JSON字符串原始数据成功`);
        
        // 🔥 转换数据格式：将steps字符串转换成AI期望的数组格式
        if (result.steps && typeof result.steps === 'string') {
          const stepsText = result.steps.replace(/\\n/g, '\n');
          const stepLines = stepsText.split('\n').filter(line => line.trim());
          
          result.steps = stepLines.map((line, index) => {
            // 清理步骤编号，统一格式
            const cleanLine = line.replace(/^\d+[、。.]?\s*/, '').trim();
            return {
              description: cleanLine,
              expectedResult: '', // 默认为空
              action: '' // 默认为空
            };
          });
          
          console.log(`🔧 [AIBulkUpdateService] 步骤格式转换完成: ${stepLines.length} 个步骤转换为数组格式`);
        }
        
      } catch (error) {
        console.error(`❌ [AIBulkUpdateService] 解析JSON字符串失败: ${error.message}`);
        throw new Error(`原始数据格式无效: ${error.message}`);
      }
    } else {
      result = JSON.parse(JSON.stringify(original));
    }
    
    for (const patch of patches) {
      const pathParts = patch.path.split('/').filter(p => p);
      
      switch (patch.op) {
        case 'replace':
          this.setValueByPath(result, pathParts, patch.value);
          break;
        case 'add':
          // 简化处理：暂时等同于replace
          this.setValueByPath(result, pathParts, patch.value);
          break;
        case 'remove':
          this.removeValueByPath(result, pathParts);
          break;
      }
    }
    
    // 🔥 如果原始数据是字符串格式，返回字符串格式（保持数据库存储格式一致）
    if (typeof original === 'string') {
      // 🔥 将数组格式的steps转换回字符串格式
      if (result.steps && Array.isArray(result.steps)) {
        const stepsText = result.steps.map((step, index) => {
          const stepNum = index + 1;
          return `${stepNum}、${step.description || ''}`;
        }).join('\n');
        
        result.steps = stepsText;
        console.log(`🔧 [AIBulkUpdateService] 步骤数组转换回字符串格式: ${result.steps.length} 个字符`);
      }
      
      console.log(`🔧 [AIBulkUpdateService] 将修改结果转换回JSON字符串格式`);
      return JSON.stringify(result);
    }
    
    return result;
  }

  /**
   * 根据路径设置值
   * @private
   */
  private setValueByPath(obj: any, path: string[], value: any): void {
    // 🔥 添加调试日志
    console.log(`🔧 [AIBulkUpdateService] setValueByPath调试:`, {
      path: path,
      pathString: '/' + path.join('/'),
      objType: typeof obj,
      obj: obj,
      value: value
    });
    
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      
      console.log(`🔧 [AIBulkUpdateService] 路径遍历[${i}]: key=${key}, currentType=${typeof current}`);
      
      // 🔥 增强类型检查，处理字符串类型的current
      if (typeof current === 'string') {
        throw new Error(`路径 ${path.slice(0, i+1).join('/')} 指向字符串，无法继续访问属性 ${key}`);
      }
      
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const finalKey = path[path.length - 1];
    console.log(`🔧 [AIBulkUpdateService] 设置最终值: key=${finalKey}, currentType=${typeof current}`);
    
    // 🔥 最终赋值前也检查类型
    if (typeof current === 'string') {
      throw new Error(`路径 ${path.join('/')} 的目标是字符串，无法设置属性 ${finalKey}`);
    }
    
    current[finalKey] = value;
  }

  /**
   * 根据路径移除值
   * @private
   */
  private removeValueByPath(obj: any, path: string[]): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) return;
      current = current[key];
    }
    delete current[path[path.length - 1]];
  }

  /**
   * 保存提案到数据库
   * @private
   */
  private async savePatchProposals(sessionId: number, proposals: CasePatchProposal[]): Promise<void> {
    console.log(`💾 [AIBulkUpdateService] 保存 ${proposals.length} 个提案到数据库...`);

    try {
      const createData = proposals.map(p => ({
        session_id: sessionId,
        case_id: p.case_id,
        diff_json: JSON.stringify(p.diff_json),
        ai_rationale: p.ai_rationale,
        side_effects: p.side_effects ? JSON.stringify(p.side_effects) : null,
        risk_level: p.risk_level,
        recall_reason: p.recall_reason,
        old_hash: p.old_hash,
        new_hash: p.new_hash,
        apply_status: p.apply_status,
        created_at: new Date()
      }));

      await this.prisma.case_patch_proposals.createMany({
        data: createData
      });

      console.log(`✅ [AIBulkUpdateService] 提案保存完成`);

    } catch (error: any) {
      console.error(`❌ [AIBulkUpdateService] 保存提案失败: ${error.message}`);
      throw error;
    }
  }
}
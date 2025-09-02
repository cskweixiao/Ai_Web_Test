import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bot,
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle,
  FileText,
  Eye,
  Settings,
  Play,
  Clock,
  Tag,
  Hash
} from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { showToast } from '../utils/toast';
import type { TestCase } from '../types/test';
import { 
  aiBulkUpdateService,
  type AIBulkUpdateParams,
  type CasePatchProposal,
  type SimplifiedProposal,
  type JsonPatch,
  type SideEffect,
  type SessionResult
} from '../services/aiBulkUpdateService';
import { monitorAIBulkUpdate, securityMonitor } from '../services/securityMonitor';

interface AIBulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  testCases: TestCase[];
  onRefresh?: () => void;
}

export function AIBulkUpdateModal({ 
  isOpen, 
  onClose, 
  testCases,
  onRefresh 
}: AIBulkUpdateModalProps) {
  // 当前步骤：configure -> preview -> apply
  const [currentStep, setCurrentStep] = useState<'configure' | 'preview' | 'apply'>('configure');
  
  // 表单数据
  const [formData, setFormData] = useState<AIBulkUpdateParams>({
    system: '',
    module: '',
    tagFilter: [],
    priorityFilter: '',
    changeBrief: '',
    userId: 1 // 模拟用户ID，实际项目中从认证状态获取
  });
  
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [selectedProposals, setSelectedProposals] = useState<number[]>([]);
  const [previewingProposal, setPreviewingProposal] = useState<CasePatchProposal | null>(null);

  // 从现有测试用例中提取系统和模块选项
  const systemOptions = Array.from(new Set(testCases.map(tc => tc.system).filter(Boolean)));
  const moduleOptions = Array.from(new Set(testCases.map(tc => tc.module).filter(Boolean)));
  const allTags = Array.from(new Set(testCases.flatMap(tc => tc.tags || [])));

  // 辅助函数：确保proposal ID为正数类型
  const ensureValidId = (id: number | string | undefined): number | null => {
    if (id === undefined || id === null) {
      console.log('⚠️ ID为空:', id);
      return null;
    }
    
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    
    if (isNaN(numericId)) {
      console.log('⚠️ ID不是数字:', id, '转换后:', numericId);
      return null;
    }
    
    // 暂时注释掉正数验证，允许任何数字ID
    // if (numericId <= 0) {
    //   console.log('⚠️ ID不是正数:', numericId);
    //   return null;
    // }
    
    console.log('✅ 有效ID:', numericId);
    return numericId;
  };

  // 重置模态框状态
  const resetModal = () => {
    setCurrentStep('configure');
    setFormData({
      system: '',
      module: '',
      tagFilter: [],
      priorityFilter: '',
      changeBrief: '',
      userId: 1
    });
    setSessionResult(null);
    setSelectedProposals([]);
    setPreviewingProposal(null);
    setLoading(false);
  };

  // 当模态框关闭时重置状态
  useEffect(() => {
    if (!isOpen) {
      // 记录模态框关闭事件
      if (sessionResult) {
        securityMonitor.logUserAction('ai_bulk_update_modal_close', 'ai_session', sessionResult.sessionId, true, undefined, {
          step: currentStep,
          proposals_generated: sessionResult.proposals.length,
          proposals_selected: selectedProposals.length
        });
      } else {
        securityMonitor.logUserAction('ai_bulk_update_modal_close', 'modal', undefined, true, undefined, {
          step: currentStep
        });
      }
      resetModal();
    } else {
      // 记录模态框打开事件
      securityMonitor.logUserAction('ai_bulk_update_modal_open', 'modal', undefined, true, undefined, {
        available_test_cases: testCases.length
      });
    }
  }, [isOpen]);

  // 执行干跑，生成提案
  const handleDryRun = async () => {
    if (!formData.changeBrief.trim()) {
      showToast.warning('请输入变更描述');
      return;
    }

    setLoading(true);
    
    // 记录干跑开始
    monitorAIBulkUpdate.startDryRun(formData);
    
    try {
      console.log('🚀 [AIBulkUpdate] 开始干跑，参数:', formData);
      
      // 调用真实的AI服务
      const result = await aiBulkUpdateService.createDryRun(formData);
      
      console.log('\ud83d\udcca \u6536\u5230\u7684\u63d0\u6848\u6570\u636e:', result);
      console.log('\ud83d\udcca \u63d0\u6848\u6570\u91cf:', result.proposals.length);
      result.proposals.forEach((proposal, index) => {
        console.log(`\ud83d\udcc4 \u63d0\u6848 ${index}:`, { id: proposal.id, case_title: proposal.case_title });
      });
      
      setSessionResult(result);
      setCurrentStep('preview');
      
      // 记录干跑完成
      monitorAIBulkUpdate.completeDryRun(result.sessionId, result.proposals.length, true);
      
      showToast.success(`✅ AI分析完成，生成了 ${result.proposals.length} 个修改提案`);
      console.log('✅ [AIBulkUpdate] 干跑完成:', result);

    } catch (error: any) {
      console.error('❌ [AIBulkUpdate] 干跑失败:', error);
      showToast.error(`干跑失败: ${error.message}`);
      
      // 记录干跑失败
      monitorAIBulkUpdate.completeDryRun(0, 0, false, error.message);
    } finally {
      setLoading(false);
    }
  };

  // 应用选中的提案
  const handleApplyProposals = async () => {
    if (selectedProposals.length === 0) {
      showToast.warning('请至少选择一个提案进行应用');
      return;
    }

    if (!sessionResult) {
      showToast.error('会话状态异常，请重新开始');
      return;
    }

    // 临时放宽验证，只检查是否存在
    const invalidIds = selectedProposals.filter(id => id === null || id === undefined);
    if (invalidIds.length > 0) {
      console.error('发现空的提案ID:', invalidIds);
      showToast.error('存在空的提案ID，请刷新页面重试');
      return;
    }

    console.log('🚀 准备应用的提案ID:', selectedProposals);

    setLoading(true);
    
    // 记录应用开始
    monitorAIBulkUpdate.applyProposals(sessionResult.sessionId, selectedProposals);
    
    try {
      console.log('🔄 [AIBulkUpdate] 开始应用提案:', selectedProposals);
      
      // 调用真实的AI服务
      const result = await aiBulkUpdateService.applyProposals(sessionResult.sessionId, selectedProposals);
      
      setCurrentStep('apply');
      
      // 记录应用完成
      monitorAIBulkUpdate.completeApply(sessionResult.sessionId, result.appliedCount, result.failedCount, result.success);
      
      if (result.success) {
        showToast.success(`✅ 批量更新完成！成功: ${result.appliedCount}, 失败: ${result.failedCount}`);
      } else {
        showToast.warning(`⚠️ 批量更新部分成功：成功: ${result.appliedCount}, 失败: ${result.failedCount}`);
      }
      
      console.log('✅ [AIBulkUpdate] 应用完成:', result);

      // 等待一秒确保后端更新完成，然后刷新测试用例列表
      console.log('⏳ [AIBulkUpdate] 等待后端处理完成...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('🔄 [AIBulkUpdate] 开始刷新测试用例列表...');
      if (onRefresh) {
        try {
          await onRefresh();
          console.log('✅ [AIBulkUpdate] 测试用例列表刷新成功');
          showToast.info('🔄 用例数据已刷新，请查看最新内容');
        } catch (error) {
          console.error('❌ [AIBulkUpdate] 测试用例列表刷新失败:', error);
          showToast.warning('数据刷新失败，请手动刷新页面查看最新内容');
        }
      } else {
        console.warn('⚠️ [AIBulkUpdate] onRefresh回调不存在');
      }

      // 3秒后自动关闭模态框
      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (error: any) {
      console.error('❌ [AIBulkUpdate] 应用失败:', error);
      showToast.error(`应用失败: ${error.message}`);
      
      // 记录应用失败
      monitorAIBulkUpdate.completeApply(sessionResult.sessionId, 0, selectedProposals.length, false, error.message);
    } finally {
      setLoading(false);
    }
  };

  // 提案选择处理
  const handleProposalToggle = (proposalId: number | string) => {
    console.log('🔄 点击提案选择:', proposalId);
    
    // 确保ID为有效的正数
    const numericId = ensureValidId(proposalId);
    if (numericId === null) {
      console.warn('无效的提案ID:', proposalId);
      return;
    }
    
    console.log('🔄 处理有效ID:', numericId);
    console.log('🔄 当前选中的提案:', selectedProposals);
    const wasSelected = selectedProposals.includes(numericId);
    console.log('🔄 是否已选中:', wasSelected);
    
    setSelectedProposals(prev => {
      const newSelection = prev.includes(numericId) 
        ? prev.filter(id => id !== numericId)
        : [...prev, numericId];
      console.log('🔄 新的选择:', newSelection);
      return newSelection;
    });
    
    // 记录提案选择/取消选择
    if (sessionResult) {
      securityMonitor.logUserAction(
        wasSelected ? 'ai_proposal_deselect' : 'ai_proposal_select',
        'ai_proposal',
        numericId,
        true,
        undefined,
        {
          session_id: sessionResult.sessionId,
          total_selected: wasSelected ? selectedProposals.length - 1 : selectedProposals.length + 1
        }
      );
    }
  };

  const selectAllProposals = () => {
    if (sessionResult) {
      const previousCount = selectedProposals.length;
      const validIds = sessionResult.proposals
        .map(p => ensureValidId(p.id))
        .filter((id): id is number => id !== null);
      setSelectedProposals(validIds);
      
      // 记录全选操作
      securityMonitor.logUserAction('ai_proposals_select_all', 'ai_session', sessionResult.sessionId, true, undefined, {
        previous_selected: previousCount,
        total_proposals: sessionResult.proposals.length
      });
    }
  };

  const deselectAllProposals = () => {
    const previousCount = selectedProposals.length;
    setSelectedProposals([]);
    
    // 记录全不选操作
    if (sessionResult) {
      securityMonitor.logUserAction('ai_proposals_deselect_all', 'ai_session', sessionResult.sessionId, true, undefined, {
        previous_selected: previousCount
      });
    }
  };

  // 🔥 移除风险等级颜色函数 - 简化界面不再显示风险分析

  // 步骤指示器
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {/* 配置步骤 */}
        <div className={clsx(
          'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
          currentStep === 'configure' 
            ? 'bg-purple-600 text-white' 
            : 'bg-purple-100 text-purple-600'
        )}>
          1
        </div>
        <span className={clsx(
          'text-sm font-medium',
          currentStep === 'configure' ? 'text-purple-600' : 'text-gray-500'
        )}>
          配置参数
        </span>
        
        <ChevronRight className="h-4 w-4 text-gray-400" />
        
        {/* 预览步骤 */}
        <div className={clsx(
          'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
          currentStep === 'preview' 
            ? 'bg-purple-600 text-white' 
            : sessionResult 
            ? 'bg-purple-100 text-purple-600'
            : 'bg-gray-100 text-gray-500'
        )}>
          2
        </div>
        <span className={clsx(
          'text-sm font-medium',
          currentStep === 'preview' ? 'text-purple-600' : sessionResult ? 'text-gray-700' : 'text-gray-500'
        )}>
          预览提案
        </span>
        
        <ChevronRight className="h-4 w-4 text-gray-400" />
        
        {/* 应用步骤 */}
        <div className={clsx(
          'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
          currentStep === 'apply' 
            ? 'bg-purple-600 text-white' 
            : 'bg-gray-100 text-gray-500'
        )}>
          3
        </div>
        <span className={clsx(
          'text-sm font-medium',
          currentStep === 'apply' ? 'text-purple-600' : 'text-gray-500'
        )}>
          应用更新
        </span>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI批量更新"
      size="full"
      footer={
        <div className="flex justify-between items-center">
          <div className="flex items-center text-sm text-gray-600">
            <Bot className="h-4 w-4 mr-1" />
            基于AI技术的智能批量更新
          </div>
          
          <div className="flex space-x-3">
            {currentStep === 'preview' && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep('configure')}
                disabled={loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                返回配置
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {currentStep === 'apply' ? '关闭' : '取消'}
            </Button>
            
            {currentStep === 'configure' && (
              <Button
                onClick={handleDryRun}
                disabled={loading || !formData.changeBrief.trim()}
                isLoading={loading}
              >
                <Bot className="h-4 w-4 mr-1" />
                生成提案
              </Button>
            )}
            
            {currentStep === 'preview' && (
              <Button
                onClick={handleApplyProposals}
                disabled={loading || selectedProposals.length === 0}
                isLoading={loading}
              >
                <Play className="h-4 w-4 mr-1" />
                应用选中提案 ({selectedProposals.length})
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <StepIndicator />

        {/* 配置步骤 */}
        {currentStep === 'configure' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-purple-600 mt-0.5 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-purple-900">智能批量更新说明</h4>
                  <p className="text-sm text-purple-800 mt-1">
                    AI将根据您的变更描述，自动识别相关的测试用例并生成修改提案。请仔细描述您的变更需求，以获得最准确的结果。
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* 左侧：过滤条件 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  过滤条件
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    目标系统
                  </label>
                  <select
                    value={formData.system}
                    onChange={(e) => setFormData(prev => ({ ...prev, system: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">所有系统</option>
                    {systemOptions.map(system => (
                      <option key={system} value={system}>{system}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    目标模块
                  </label>
                  <select
                    value={formData.module}
                    onChange={(e) => setFormData(prev => ({ ...prev, module: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">所有模块</option>
                    {moduleOptions.map(module => (
                      <option key={module} value={module}>{module}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    优先级过滤
                  </label>
                  <select
                    value={formData.priorityFilter}
                    onChange={(e) => setFormData(prev => ({ ...prev, priorityFilter: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">所有优先级</option>
                    <option value="high">高优先级</option>
                    <option value="medium">中优先级</option>
                    <option value="low">低优先级</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    标签过滤
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {allTags.length === 0 ? (
                      <p className="text-gray-500 text-sm">暂无可用标签</p>
                    ) : (
                      <div className="space-y-1">
                        {allTags.map(tag => (
                          <label key={tag} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.tagFilter?.includes(tag) || false}
                              onChange={(e) => {
                                const newTags = formData.tagFilter || [];
                                if (e.target.checked) {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    tagFilter: [...newTags, tag] 
                                  }));
                                } else {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    tagFilter: newTags.filter(t => t !== tag) 
                                  }));
                                }
                              }}
                              className="rounded text-purple-600 focus:ring-purple-500 mr-2"
                            />
                            <span className="text-sm text-gray-700">{tag}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 右侧：变更描述 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  变更描述 *
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    请详细描述您要进行的变更
                  </label>
                  <textarea
                    rows={8}
                    value={formData.changeBrief}
                    onChange={(e) => setFormData(prev => ({ ...prev, changeBrief: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="例如：&#10;将所有登录相关的测试用例中的&quot;点击登录按钮&quot;改为&quot;双击登录按钮&quot;，因为产品交互方式发生了变化。同时需要更新相关的验证步骤。"
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">✨ 描述建议</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• 明确说明变更的原因和目标</li>
                    <li>• 描述具体需要修改的内容</li>
                    <li>• 提及可能受影响的测试步骤或验证点</li>
                    <li>• 使用关键词帮助AI更好地匹配相关用例</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 预览步骤 */}
        {currentStep === 'preview' && sessionResult && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-green-900">AI分析完成</h4>
                  <p className="text-sm text-green-800 mt-1">
                    从 {sessionResult.totalCases} 个测试用例中识别出 {sessionResult.proposals.length} 个相关用例，
                    请审核修改提案并选择要应用的更新。
                  </p>
                </div>
              </div>
            </div>

            {/* 批量选择操作 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">
                  批量操作：
                </span>
                <button
                  onClick={selectAllProposals}
                  className="text-sm text-purple-600 hover:text-purple-700 underline"
                >
                  全选
                </button>
                <button
                  onClick={deselectAllProposals}
                  className="text-sm text-gray-600 hover:text-gray-700 underline"
                >
                  全不选
                </button>
              </div>
              <div className="text-sm text-gray-600">
                已选择 {selectedProposals.length} / {sessionResult.proposals.length} 个提案
              </div>
            </div>

            {/* 提案列表 - 使用简化的提案数据 */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {(sessionResult.simplifiedProposals || sessionResult.proposals).map((proposal) => {
                // 🔥 适配不同的数据源
                const isSimplified = 'original_content' in proposal;
                const proposalId = isSimplified ? proposal.id : proposal.id;
                const validId = ensureValidId(proposalId);
                const isSelected = validId !== null && selectedProposals.includes(validId);
                
                return (
                <div
                  key={proposal.id}
                  className={clsx(
                    'border rounded-lg p-4 transition-all',
                    isSelected
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (validId !== null) {
                            handleProposalToggle(validId);
                          }
                        }}
                        disabled={validId === null}
                        className="mt-1 rounded text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          📋 {isSimplified ? proposal.case_title : proposal.case_title}
                        </h4>
                        
                        {/* 🔥 简化显示：只显示修改前后对比 */}
                        {isSimplified ? (
                          <div className="space-y-4">
                            {/* 修改前内容 */}
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <div className="flex items-center mb-2">
                                <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded">修改前</span>
                              </div>
                              <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">
                                {(proposal as SimplifiedProposal).original_content}
                              </pre>
                            </div>
                            
                            {/* 修改后内容 */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center mb-2">
                                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">修改后</span>
                              </div>
                              <pre className="text-xs text-green-700 whitespace-pre-wrap font-mono">
                                {(proposal as SimplifiedProposal).modified_content}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          /* 保留原有复杂显示作为兜底 */
                          <div className="space-y-2">
                            <div className="flex items-center space-x-4 mb-3">
                              <span className="text-xs text-gray-500 flex items-center">
                                <Hash className="h-3 w-3 mr-1" />
                                用例 #{proposal.case_id}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">
                              <strong>AI分析：</strong>{(proposal as CasePatchProposal).ai_rationale}
                            </p>
                            <p className="text-sm text-gray-600">
                              <strong>匹配原因：</strong>{(proposal as CasePatchProposal).recall_reason}
                            </p>
                          </div>
                        )}
                        
                        {/* 🔥 移除副作用显示 - 简化界面 */}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setPreviewingProposal(proposal)}
                      className="p-1 text-gray-400 hover:text-purple-600 transition-colors ml-2"
                      title="预览具体变更"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* 应用步骤 */}
        {currentStep === 'apply' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="text-center py-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              {loading ? (
                <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-600" />
              )}
            </div>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {loading ? '正在应用更新...' : '批量更新完成！'}
            </h3>
            
            <p className="text-gray-600 mb-6">
              {loading 
                ? `正在应用 ${selectedProposals.length} 个修改提案，请稍候...`
                : `成功应用了 ${selectedProposals.length} 个修改提案，测试用例已更新。`
              }
            </p>
            
            {!loading && (
              <div className="text-sm text-gray-500">
                <Clock className="h-4 w-4 inline mr-1" />
                3秒后自动关闭此窗口
              </div>
            )}
          </motion.div>
        )}

        {/* 🔥 简化的提案预览模态框 */}
        {previewingProposal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">📋 用例修改预览</h3>
                <button
                  onClick={() => setPreviewingProposal(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h4 className="text-lg font-medium text-gray-900">{previewingProposal.case_title}</h4>
                  <p className="text-sm text-gray-500">用例 #{previewingProposal.case_id}</p>
                </div>
                
                {/* 🔥 简化显示：只显示修改前后对比 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 修改前内容 */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <span className="text-sm font-medium text-red-700 bg-red-100 px-3 py-1 rounded-full">🔴 修改前</span>
                    </div>
                    <pre className="text-sm text-red-700 whitespace-pre-wrap font-mono leading-relaxed">
                      {(() => {
                        // 🔥 查找对应的简化提案来获取原始内容
                        const simplifiedProposal = sessionResult?.simplifiedProposals?.find(sp => sp.case_id === previewingProposal.case_id);
                        return simplifiedProposal?.original_content || `测试用例：${previewingProposal.case_title}\n\n原始内容...`;
                      })()}
                    </pre>
                  </div>
                  
                  {/* 修改后内容 */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <span className="text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">🟢 修改后</span>
                    </div>
                    <pre className="text-sm text-green-700 whitespace-pre-wrap font-mono leading-relaxed">
                      {(() => {
                        // 🔥 查找对应的简化提案来获取修改后内容
                        const simplifiedProposal = sessionResult?.simplifiedProposals?.find(sp => sp.case_id === previewingProposal.case_id);
                        return simplifiedProposal?.modified_content || `测试用例：${previewingProposal.case_title}\n\n修改后内容...`;
                      })()}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
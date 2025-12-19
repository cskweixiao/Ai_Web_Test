import React, { useState, useEffect } from 'react';
import { Modal, Timeline, Tag, Empty, Spin, Image, Collapse } from 'antd';
import { CheckCircle, XCircle, AlertCircle, Clock, FileText, ChevronDown } from 'lucide-react';
import { testPlanService } from '../services/testPlanService';
import type { TestPlanExecution, TestPlanCaseResult, ExecutionResult } from '../types/testPlan';

interface TestPlanExecutionLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  executionId: string;
}

export const TestPlanExecutionLogModal: React.FC<TestPlanExecutionLogModalProps> = ({
  isOpen,
  onClose,
  executionId,
}) => {
  const [execution, setExecution] = useState<TestPlanExecution | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && executionId) {
      loadExecutionDetail();
    }
  }, [isOpen, executionId]);

  const loadExecutionDetail = async () => {
    setLoading(true);
    try {
      const result = await testPlanService.getTestPlanExecutionDetail(executionId);
      setExecution(result);
    } catch (error) {
      console.error('加载执行详情失败:', error);
      setExecution(null);
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (result: ExecutionResult) => {
    switch (result) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'block':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'skip':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getResultTag = (result: ExecutionResult) => {
    switch (result) {
      case 'pass':
        return <Tag color="success">通过</Tag>;
      case 'fail':
        return <Tag color="error">失败</Tag>;
      case 'block':
        return <Tag color="warning">阻塞</Tag>;
      case 'skip':
        return <Tag color="default">跳过</Tag>;
      default:
        return <Tag color="default">未执行</Tag>;
    }
  };

  const getResultColor = (result: ExecutionResult) => {
    switch (result) {
      case 'pass': return 'green';
      case 'fail': return 'red';
      case 'block': return 'orange';
      case 'skip': return 'gray';
      default: return 'gray';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    return `${(ms / 1000).toFixed(1)}秒`;
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <span className="font-bold">执行详情</span>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={900}
      bodyStyle={{
        maxHeight: '75vh',
        overflowY: 'auto',
        padding: '16px 24px',
      }}
    >
      <div className="py-4">
        {loading ? (
          <div className="text-center py-12">
            <Spin size="large" />
            <p className="text-gray-500 mt-4">加载执行详情中...</p>
          </div>
        ) : !execution ? (
          <Empty
            description="未找到执行记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div className="space-y-6">
            {/* 执行概览 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">执行人</div>
                  <div className="text-base font-semibold text-gray-900">{execution.executor_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">执行时间</div>
                  <div className="text-base font-semibold text-gray-900">
                    {new Date(execution.started_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">执行类型</div>
                  <div className="text-base font-semibold text-gray-900">
                    {execution.execution_type === 'functional' ? '功能测试' : 'UI自动化'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">总耗时</div>
                  <div className="text-base font-semibold text-gray-900">
                    {formatDuration(execution.duration_ms)}
                  </div>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="grid grid-cols-6 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{execution.total_cases}</div>
                    <div className="text-xs text-gray-600">总用例</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{execution.completed_cases}</div>
                    <div className="text-xs text-gray-600">已完成</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{execution.passed_cases}</div>
                    <div className="text-xs text-gray-600">通过</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{execution.failed_cases}</div>
                    <div className="text-xs text-gray-600">失败</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{execution.blocked_cases}</div>
                    <div className="text-xs text-gray-600">阻塞</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">{execution.skipped_cases}</div>
                    <div className="text-xs text-gray-600">跳过</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 用例执行详情 */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">用例执行详情</h3>
              {(!execution.execution_results || execution.execution_results.length === 0) ? (
                <Empty
                  description="暂无用例执行记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Collapse
                  accordion
                  expandIcon={({ isActive }) => <ChevronDown className={`w-4 h-4 transition-transform ${isActive ? 'rotate-180' : ''}`} />}
                  items={execution.execution_results.map((caseResult: TestPlanCaseResult, index: number) => ({
                    key: index,
                    label: (
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          {getResultIcon(caseResult.result)}
                          <span className="font-medium text-gray-900">{caseResult.case_name}</span>
                          {getResultTag(caseResult.result)}
                        </div>
                        {caseResult.duration_ms && (
                          <span className="text-sm text-gray-500">
                            耗时: {formatDuration(caseResult.duration_ms)}
                          </span>
                        )}
                      </div>
                    ),
                    children: (
                      <div className="space-y-3 pl-2">
                        {/* 步骤统计 */}
                        {caseResult.totalSteps !== undefined && caseResult.totalSteps > 0 && (
                          <div className="p-3 bg-gray-50 rounded border border-gray-200">
                            <div className="flex gap-4 text-xs">
                              <span className="text-gray-600">
                                总步骤: <span className="font-semibold text-gray-800">{caseResult.totalSteps}</span>
                              </span>
                              {caseResult.completedSteps !== undefined && (
                                <span className="text-blue-600">
                                  已完成: <span className="font-semibold">{caseResult.completedSteps}</span>
                                </span>
                              )}
                              {caseResult.passedSteps !== undefined && caseResult.passedSteps > 0 && (
                                <span className="text-green-600">
                                  ✓ 通过: <span className="font-semibold">{caseResult.passedSteps}</span>
                                </span>
                              )}
                              {caseResult.failedSteps !== undefined && caseResult.failedSteps > 0 && (
                                <span className="text-red-600">
                                  ✗ 失败: <span className="font-semibold">{caseResult.failedSteps}</span>
                                </span>
                              )}
                              {caseResult.blockedSteps !== undefined && caseResult.blockedSteps > 0 && (
                                <span className="text-orange-600">
                                  ⚠ 阻塞: <span className="font-semibold">{caseResult.blockedSteps}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 实际结果 */}
                        {caseResult.actualResult && (
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-xs font-semibold text-blue-800 mb-1">实际结果总结</div>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {caseResult.actualResult}
                            </p>
                          </div>
                        )}

                        {/* 备注 */}
                        {caseResult.comments && (
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-xs font-semibold text-gray-700 mb-1">备注</div>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {caseResult.comments}
                            </p>
                          </div>
                        )}

                        {/* 截图 */}
                        {caseResult.screenshots && caseResult.screenshots.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                              📷 截图: 共 {caseResult.screenshots.length} 张
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Image.PreviewGroup>
                                {caseResult.screenshots.map((screenshot, idx) => {
                                  const mimeType = screenshot.mimeType || 'image/png';
                                  const base64Data = screenshot.base64Data || '';
                                  const imageUrl = base64Data.startsWith('data:')
                                    ? base64Data
                                    : `data:${mimeType};base64,${base64Data}`;

                                  return (
                                    <Image
                                      key={idx}
                                      src={imageUrl}
                                      alt={screenshot.fileName || screenshot.filename || `截图${idx + 1}`}
                                      width={100}
                                      height={100}
                                      className="rounded border border-gray-200 object-cover cursor-pointer hover:border-blue-400 transition-colors"
                                      style={{ objectFit: 'cover' }}
                                      preview={{
                                        mask: <div className="text-xs">点击预览</div>,
                                      }}
                                    />
                                  );
                                })}
                              </Image.PreviewGroup>
                            </div>
                          </div>
                        )}

                        {/* 错误信息 */}
                        {caseResult.error_message && (
                          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="text-xs font-semibold text-red-800 mb-1">错误信息</div>
                            <p className="text-sm text-red-700 leading-relaxed whitespace-pre-wrap">
                              {caseResult.error_message}
                            </p>
                          </div>
                        )}

                        {/* 执行时间 */}
                        {caseResult.executed_at && (
                          <div className="text-xs text-gray-500">
                            执行时间: {new Date(caseResult.executed_at).toLocaleString('zh-CN')}
                          </div>
                        )}
                      </div>
                    ),
                  }))}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};


import React from 'react';
import { Modal, Tag, Empty, Image, Timeline } from 'antd';
import { CheckCircle, XCircle, AlertCircle, Clock, FileText } from 'lucide-react';
import type { TestPlanCaseResult, ExecutionResult } from '../types/testPlan';

interface TestPlanCaseExecutionLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseResult: TestPlanCaseResult | null;
}

export const TestPlanCaseExecutionLogModal: React.FC<TestPlanCaseExecutionLogModalProps> = ({
  isOpen,
  onClose,
  caseResult,
}) => {
  const getStatusIcon = (result: ExecutionResult) => {
    switch (result) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'block':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'skip':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusTag = (result: ExecutionResult) => {
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

  const getStatusColor = (result: ExecutionResult) => {
    switch (result) {
      case 'pass': return 'green';
      case 'fail': return 'red';
      case 'block': return 'orange';
      default: return 'gray';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}毫秒`;
    return `${(ms / 1000).toFixed(2)}秒`;
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <span className="font-bold">执行日志</span>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={800}
      className="execution-log-modal"
      styles={{
        body: {
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: '16px 24px',
        },
      }}
    >
      <div className="py-4">
        {!caseResult ? (
          <Empty
            description="暂无执行记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Timeline
            items={[
              {
                dot: getStatusIcon(caseResult.result),
                color: getStatusColor(caseResult.result),
                children: (
                  <div className="pb-4">
                    {/* 基本信息行 */}
                    <div className="flex items-center gap-3 mb-3">
                      {getStatusTag(caseResult.result)}
                      <span className="text-sm text-gray-500">
                        {caseResult.executed_at
                          ? new Date(caseResult.executed_at).toLocaleString('zh-CN')
                          : caseResult.started_at
                          ? new Date(caseResult.started_at).toLocaleString('zh-CN')
                          : '-'}
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        执行人: {caseResult.executor_name || '-'}
                      </span>
                      {caseResult.duration_ms && (
                        <span className="text-sm text-gray-500">
                          耗时: {formatDuration(caseResult.duration_ms)}
                        </span>
                      )}
                    </div>

                    {/* 步骤统计信息 */}
                    {caseResult.totalSteps !== undefined && caseResult.totalSteps > 0 && (
                      <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
                        <div className="flex gap-4 text-xs">
                          <span className="text-gray-600">
                            总步骤: <span className="font-semibold text-gray-800">{caseResult.totalSteps}</span>
                          </span>
                          {caseResult.completedSteps && (
                            <span className="text-blue-600">
                              已完成: <span className="font-semibold">{caseResult.completedSteps}</span>
                            </span>
                          )}
                          {caseResult.passedSteps && (
                            <span className="text-green-600">
                              ✓ 通过: <span className="font-semibold">{caseResult.passedSteps}</span>
                            </span>
                          )}
                          {caseResult.failedSteps !== undefined && caseResult.failedSteps !== null && (
                            <span className="text-red-600">
                              ✗ 失败: <span className="font-semibold">{caseResult.failedSteps}</span>
                            </span>
                          )}
                          {caseResult.blockedSteps !== undefined && caseResult.blockedSteps !== null && (
                            <span className="text-orange-600">
                              ⚠ 受阻: <span className="font-semibold">{caseResult.blockedSteps}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 实际结果 */}
                    {caseResult.actualResult && (
                      <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-xs font-semibold text-blue-800 mb-1">实际结果总结</div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {caseResult.actualResult}
                        </p>
                      </div>
                    )}

                    {/* 备注 */}
                    {caseResult.comments && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-1">备注</div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {caseResult.comments}
                        </p>
                      </div>
                    )}

                    {/* 错误信息 */}
                    {caseResult.error_message && (
                      <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="text-xs font-semibold text-red-800 mb-1">错误信息</div>
                        <p className="text-sm text-red-700 leading-relaxed whitespace-pre-wrap">
                          {caseResult.error_message}
                        </p>
                      </div>
                    )}

                    {/* 截图预览 */}
                    {caseResult.screenshots && caseResult.screenshots.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                          📷 截图: 共 {caseResult.screenshots.length} 张
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Image.PreviewGroup>
                            {caseResult.screenshots.map((screenshot, index) => {
                              // 构建完整的 Data URL
                              const mimeType = screenshot.mimeType || 'image/png';
                              const base64Data = screenshot.base64Data || '';
                              // 如果 base64Data 已经包含 data: 前缀，直接使用；否则添加前缀
                              const imageUrl = base64Data.startsWith('data:')
                                ? base64Data
                                : `data:${mimeType};base64,${base64Data}`;

                              return (
                                <Image
                                  key={index}
                                  src={imageUrl}
                                  alt={screenshot.fileName || screenshot.filename || `截图${index + 1}`}
                                  width={100}
                                  height={100}
                                  className="rounded border border-gray-200 object-cover cursor-pointer hover:border-blue-400 transition-colors"
                                  style={{ objectFit: 'cover' }}
                                  preview={{
                                    mask: (
                                      <div className="text-xs">
                                        点击预览
                                      </div>
                                    ),
                                  }}
                                />
                              );
                            })}
                          </Image.PreviewGroup>
                        </div>
                      </div>
                    )}

                    {/* 附件统计 */}
                    {caseResult.attachments && caseResult.attachments.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          📎 附件: <span className="font-medium text-gray-700">{caseResult.attachments.length}</span> 个
                        </span>
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
    </Modal>
  );
};


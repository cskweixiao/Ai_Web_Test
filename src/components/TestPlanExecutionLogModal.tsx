import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Tag, Empty, Spin, Table, Tooltip, Space, Pagination } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileText } from 'lucide-react';
import { testPlanService } from '../services/testPlanService';
import type { TestPlanExecution, TestPlanCaseResult, ExecutionResult } from '../types/testPlan';
import { TestPlanCaseExecutionLogModal } from './TestPlanCaseExecutionLogModal';

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
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [currentCaseResult, setCurrentCaseResult] = useState<TestPlanCaseResult | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
  });

  useEffect(() => {
    if (isOpen && executionId) {
      loadExecutionDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, executionId]);

  const loadExecutionDetail = async () => {
    setLoading(true);
    try {
      const result = await testPlanService.getTestPlanExecutionDetail(executionId);
      
      // 🔥 调试日志：检查加载的执行详情数据
      console.log('📥 [执行详情] 加载的数据:', {
        executionId,
        总用例数: result.total_cases,
        已完成: result.completed_cases,
        通过: result.passed_cases,
        失败: result.failed_cases,
        execution_results数量: result.execution_results?.length || 0,
        用例详情: result.execution_results?.map((r: unknown) => {
          const record = r as Record<string, unknown>;
          return {
            case_id: record.case_id,
            case_name: record.case_name,
            result: record.result,
            有execution_id: !!record.execution_id,
            有actualResult: !!record.actualResult,
            有screenshots: !!record.screenshots && Array.isArray(record.screenshots) && record.screenshots.length > 0,
            步骤统计: {
              total: record.totalSteps,
              passed: record.passedSteps,
              failed: record.failedSteps,
              blocked: record.blockedSteps,
            },
          };
        }),
      });
      
      setExecution(result);
    } catch (error) {
      console.error('加载执行详情失败:', error);
      setExecution(null);
    } finally {
      setLoading(false);
    }
  };

  const getResultTag = (result: ExecutionResult) => {
    switch (result) {
      case 'pass':
        return <Tag style={{ marginInlineEnd: 0 }} color="success">通过</Tag>;
      case 'fail':
        return <Tag style={{ marginInlineEnd: 0 }} color="error">失败</Tag>;
      case 'block':
        return <Tag style={{ marginInlineEnd: 0 }} color="warning">阻塞</Tag>;
      case 'skip':
        return <Tag style={{ marginInlineEnd: 0 }} color="default">跳过</Tag>;
      default:
        return <Tag style={{ marginInlineEnd: 0 }} color="default">未执行</Tag>;
    }
  };

  const getExecutionStatusText = (result: ExecutionResult) => {
    console.log(result);
    switch (result) {
      case 'pass':
      case 'fail':
      case 'block':
        return '已完成';
      case 'skip':
        return '已跳过';
      default:
        return '未执行';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}毫秒`;
    return `${(ms / 1000).toFixed(2)}秒`;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleViewLogs = (caseResult: TestPlanCaseResult) => {
    setCurrentCaseResult(caseResult);
    setLogModalOpen(true);
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ page, pageSize });
  };

  // 计算分页后的数据
  const paginatedData = useMemo(() => {
    if (!execution?.execution_results) return [];
    const { page, pageSize } = pagination;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return execution.execution_results.slice(start, end);
  }, [execution?.execution_results, pagination]);

  // 计算分页信息
  const paginationInfo = useMemo(() => {
    const total = execution?.execution_results?.length || 0;
    return {
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
      ...pagination,
    };
  }, [execution?.execution_results?.length, pagination]);

  // 表格列定义
  const columns: ColumnsType<TestPlanCaseResult> = [
    {
      title: <div style={{ marginLeft: '2px' }}>ID</div>,
      dataIndex: 'case_id',
      key: 'case_id',
      width: 20,
      fixed: 'left',
      // align: 'center',
      render: (id: number) => (
        <span className="font-mono text-gray-700">{`TC_${String(id).padStart(5, '0')}`}</span>
      ),
    },
    {
      title: '用例名称',
      dataIndex: 'case_name',
      key: 'case_name',
      width: 140,
      ellipsis: true,
      render: (text: string) => (
        <span className="font-medium text-gray-900">{text}</span>
      ),
    },
    // {
    //   title: '用例版本',
    //   key: 'version',
    //   width: 90,
    //   align: 'center',
    //   render: () => '-', // 当前数据结构中没有版本字段，显示占位符
    // },
    // {
    //   title: '用例类型',
    //   dataIndex: 'case_type',
    //   key: 'case_type',
    //   width: 110,
    //   align: 'center',
    //   render: (caseType: TestCaseType) => getCaseTypeTag(caseType),
    // },
    // {
    //   title: '优先级',
    //   key: 'priority',
    //   width: 80,
    //   align: 'center',
    //   render: () => '-', // 当前数据结构中没有优先级字段，显示占位符
    // },
    // {
    //   title: '用例来源',
    //   key: 'source',
    //   width: 100,
    //   align: 'center',
    //   render: () => '-', // 当前数据结构中没有来源字段，显示占位符
    // },
    {
      title: '总步骤',
      dataIndex: 'totalSteps',
      key: 'totalSteps',
      width: 20,
      align: 'center',
      render: (steps?: number) => (
        <span className="font-semibold text-gray-700">
          {steps !== undefined ? steps : '0'}
        </span>
      ),
    },
    {
      title: '通过',
      dataIndex: 'passedSteps',
      key: 'passedSteps',
      width: 20,
      align: 'center',
      render: (passed?: number) => (
        <span className={`font-semibold ${passed && passed >= 0 ? 'text-green-600' : 'text-gray-400'}`}>
          {passed !== undefined ? passed : '0'}
        </span>
      ),
    },
    {
      title: '失败',
      dataIndex: 'failedSteps',
      key: 'failedSteps',
      width: 20,
      align: 'center',
      render: (failed?: number) => (
        <span className="font-semibold text-red-600">
          {failed !== undefined ? failed : '0'}
        </span>
      ),
    },
    {
      title: '阻塞',
      dataIndex: 'blockedSteps',
      key: 'blockedSteps',
      width: 20,
      align: 'center',
      render: (blocked?: number) => (
        <span className="font-semibold text-orange-600">
          {blocked !== undefined ? blocked : '0'}
        </span>
      ),
    },
    {
      title: '执行状态',
      key: 'execution_status',
      width: 20,
      align: 'center',
      render: (_: unknown, record: TestPlanCaseResult) => (
        <span className="text-sm text-gray-700">
          {getExecutionStatusText(record.result)}
        </span>
      ),
    },
    {
      title: '执行结果',
      dataIndex: 'result',
      key: 'result',
      width: 20,
      align: 'center',
      render: (result: ExecutionResult) => getResultTag(result),
    },
    {
      title: '执行人',
      dataIndex: 'executor_name',
      key: 'executor_name',
      width: 20,
      align: 'center',
      render: (name?: string) => (
        <span className="text-sm text-gray-700">
          {name || execution?.executor_name || '-'}
        </span>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 40,
      render: (time?: string) => (
        <span className="text-sm text-gray-700">
          {formatDateTime(time)}
        </span>
      ),
    },
    {
      title: '结束时间',
      dataIndex: 'finished_at',
      key: 'finished_at',
      width: 40,
      render: (time?: string) => (
        <span className="text-sm text-gray-700">
          {formatDateTime(time)}
        </span>
      ),
    },
    {
      title: '执行耗时',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 25,
      align: 'center',
      render: (duration?: number) => (
        <span className="text-sm font-medium text-gray-700">
          {formatDuration(duration)}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 25,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: TestPlanCaseResult) => (
        <Space size={4}>
          <Tooltip title="查看执行日志">
            <button
             className="flex items-center transition-all gap-1 text-sm font-medium text-gray-700 hover:!text-gray-600 hover:!bg-gray-50 mt-2" 
              onClick={() => handleViewLogs(record)}>
              <FileText className="w-4 h-4" />
              日志
            </button>
          </Tooltip>
        </Space>
      ),
    },
  ];

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
      width={1700}
      bodyStyle={{
        maxHeight: '85vh',
        overflowY: 'auto',
        padding: '16px',
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
            {/* 统计信息 */}
            <div className="grid grid-cols-6 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                <div className="text-3xl font-bold text-gray-900 mb-1">{execution.total_cases}</div>
                <div className="text-sm text-gray-500">总用例</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">{execution.completed_cases}</div>
                <div className="text-sm text-gray-500">已完成</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">{execution.passed_cases}</div>
                <div className="text-sm text-gray-500">通过</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                <div className="text-3xl font-bold text-red-600 mb-1">{execution.failed_cases}</div>
                <div className="text-sm text-gray-500">失败</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                <div className="text-3xl font-bold text-yellow-600 mb-1">{execution.blocked_cases}</div>
                <div className="text-sm text-gray-500">阻塞</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                <div className="text-3xl font-bold text-gray-600 mb-1">{execution.skipped_cases}</div>
                <div className="text-sm text-gray-500">跳过</div>
              </div>
            </div>

            {/* 用例执行详情表格 */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">用例执行详情</h3>
              
              {(!execution.execution_results || execution.execution_results.length === 0) ? (
                <Empty
                  description="暂无用例执行记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <Table
                    size="small"
                    columns={columns}
                    dataSource={paginatedData}
                    rowKey={(record) => `${record.case_id}-${record.execution_id || ''}`}
                    pagination={false}
                    scroll={{ x: 1500 }}
                    bordered
                    rowClassName={(record) => {
                      switch (record.result) {
                        case 'pass':
                          return 'bg-green-50/30 hover:bg-green-50/50';
                        case 'fail':
                          return 'bg-red-50/30 hover:bg-red-50/50';
                        case 'block':
                          return 'bg-yellow-50/30 hover:bg-yellow-50/50';
                        default:
                          return '';
                      }
                    }}
                  />

                  {/* 分页 */}
                  {paginationInfo.total > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-500">
                          共 <span className="font-semibold text-gray-700">{paginationInfo.total}</span> 条记录，
                          第 <span className="font-semibold text-gray-700">{paginationInfo.page}</span> / <span className="font-semibold text-gray-700">{paginationInfo.totalPages}</span> 页
                        </div>
                      </div>
                      <Pagination
                        size="small"
                        current={paginationInfo.page}
                        pageSize={paginationInfo.pageSize}
                        total={paginationInfo.total}
                        showSizeChanger
                        showQuickJumper
                        pageSizeOptions={['10', '20', '50', '100']}
                        onChange={handlePageChange}
                        onShowSizeChange={handlePageChange}
                        locale={{
                          items_per_page: '条/页',
                          jump_to: '跳至',
                          page: '页',
                          prev_page: '上一页',
                          next_page: '下一页'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 执行详情弹窗 */}
      <TestPlanCaseExecutionLogModal
        isOpen={logModalOpen}
        onClose={() => {
          setLogModalOpen(false);
          setCurrentCaseResult(null);
        }}
        caseResult={currentCaseResult}
      />
    </Modal>
  );
};

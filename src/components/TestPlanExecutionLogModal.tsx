import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Modal, Tag, Empty, Spin, Table, Tooltip, Space, Pagination } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileText, RefreshCw } from 'lucide-react';
import { testPlanService } from '../services/testPlanService';
import { testService } from '../services/testService';
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
  const [loading, setLoading] = useState(false);  // 首次加载状态
  const [isRefreshing, setIsRefreshing] = useState(false);  // 🔥 新增：刷新状态（轻量指示器）
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [currentCaseResult, setCurrentCaseResult] = useState<TestPlanCaseResult | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
  });
  
  // 🔥 用于跟踪刷新防抖
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 🔥 用于标记是否已完成首次加载
  const hasLoadedRef = useRef(false);

  // 🔥 优化：弹窗打开时重置首次加载标记，并加载数据
  useEffect(() => {
    if (isOpen && executionId) {
      hasLoadedRef.current = false;  // 重置首次加载标记
      loadExecutionDetail(false);  // 首次加载，显示全屏Spin
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, executionId]);

  // 🔥 新增：WebSocket监听器 - 监听测试完成事件，实时更新执行历史数据
  useEffect(() => {
    if (!isOpen || !executionId) return;

    console.log('🔌 [TestPlanExecutionLogModal] 初始化WebSocket监听器, executionId:', executionId);

    // 初始化WebSocket连接
    testService.initializeWebSocket().catch(error => {
      console.error('❌ [TestPlanExecutionLogModal] WebSocket连接初始化失败:', error);
    });

    // 添加WebSocket消息监听器
    const listenerId = `test-plan-execution-log-${executionId}`;
    
    testService.addMessageListener(listenerId, (message) => {
      console.log('📨 [TestPlanExecutionLogModal] 收到WebSocket消息:', message.type);

      // 监听所有测试相关事件，实时刷新
      if (message.type === 'test_complete' || message.type === 'test_update') {
        console.log('🔄 [TestPlanExecutionLogModal] 测试状态变化，准备刷新数据');
        
        // 清除之前的刷新定时器，防止频繁刷新
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        
        // 减少延迟，更快响应
        refreshTimeoutRef.current = setTimeout(() => {
          loadExecutionDetail(true);  // 🔥 静默刷新，不显示全屏Spin
          refreshTimeoutRef.current = null;
        }, 200);
      }
    });

    // 组件卸载或关闭时清理监听器和定时器
    return () => {
      console.log('🧹 [TestPlanExecutionLogModal] 清理WebSocket监听器');
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      testService.removeMessageListener(listenerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, executionId]);

  // 🔥 新增：轮询机制 - 当有运行中的测试时，定期刷新数据（备用方案）
  useEffect(() => {
    if (!isOpen || !executionId || !execution) return;
    
    // 检查是否有运行中的执行记录
    const hasRunningExecution = execution.status === 'running' || execution.status === 'queued';
    
    if (!hasRunningExecution) {
      return; // 没有运行中的测试，不需要轮询
    }
    
    console.log('⏱️ [TestPlanExecutionLogModal] 检测到运行中的测试，启动轮询机制');
    
    // 每3秒刷新一次数据
    const pollInterval = setInterval(() => {
      console.log('🔄 [TestPlanExecutionLogModal] 轮询刷新执行详情数据');
      loadExecutionDetail(true);  // 🔥 静默刷新，不显示全屏Spin
    }, 3000);
    
    // 组件卸载或状态变化时清理定时器
    return () => {
      console.log('🧹 [TestPlanExecutionLogModal] 清理轮询定时器');
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, executionId, execution?.status]);

  // 🔥 优化：支持静默刷新模式，区分首次加载和数据刷新
  const loadExecutionDetail = useCallback(async (isSilentRefresh: boolean = false) => {
    // 首次加载时显示全屏Spin，刷新时只显示轻量指示器
    if (!isSilentRefresh && !hasLoadedRef.current) {
      setLoading(true);
    } else {
      setIsRefreshing(true);  // 🔥 只显示轻量刷新指示器
    }
    
    try {
      const result = await testPlanService.getTestPlanExecutionDetail(executionId);
      
      // 🔥 调试日志：检查加载的执行详情数据
      console.log('📥 [执行详情] 加载的数据:', {
        executionId,
        isSilentRefresh,
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
      
      // 🔥 优化：比较数据是否有变化，避免不必要的状态更新
      setExecution(prevExecution => {
        // 如果是首次加载，直接设置
        if (!prevExecution) return result;
        
        // 🔥 修复：更完善的比较逻辑，包括比较用例执行结果的内容变化
        const hasBasicChange = 
          prevExecution.status !== result.status ||
          prevExecution.completed_cases !== result.completed_cases ||
          prevExecution.passed_cases !== result.passed_cases ||
          prevExecution.failed_cases !== result.failed_cases ||
          prevExecution.progress !== result.progress ||
          prevExecution.duration_ms !== result.duration_ms ||
          prevExecution.finished_at !== result.finished_at ||
          prevExecution.execution_results?.length !== result.execution_results?.length;
        
        // 🔥 新增：检查用例执行结果的内容变化
        let hasResultsChange = false;
        if (!hasBasicChange && prevExecution.execution_results && result.execution_results) {
          for (let i = 0; i < result.execution_results.length; i++) {
            const prevResult = prevExecution.execution_results[i];
            const newResult = result.execution_results[i];
            if (prevResult && newResult && (
              prevResult.result !== newResult.result ||
              prevResult.execution_status !== newResult.execution_status ||
              prevResult.duration_ms !== newResult.duration_ms ||
              prevResult.passedSteps !== newResult.passedSteps ||
              prevResult.failedSteps !== newResult.failedSteps ||
              prevResult.completedSteps !== newResult.completedSteps
            )) {
              hasResultsChange = true;
              console.log('📊 [执行详情] 检测到用例结果变化:', {
                case_id: newResult.case_id,
                prev_status: prevResult.execution_status,
                new_status: newResult.execution_status,
                prev_result: prevResult.result,
                new_result: newResult.result
              });
              break;
            }
          }
        }
        
        const hasChange = hasBasicChange || hasResultsChange;
        
        if (!hasChange && isSilentRefresh) {
          console.log('📊 [执行详情] 数据无变化，跳过更新');
          return prevExecution;
        }
        
        console.log('📊 [执行详情] 检测到数据变化，更新状态:', { hasBasicChange, hasResultsChange });
        return result;
      });
      
      hasLoadedRef.current = true;  // 标记首次加载完成
    } catch (error) {
      console.error('加载执行详情失败:', error);
      if (!isSilentRefresh) {
        setExecution(null);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [executionId]);

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

  // 🔥 修复：根据 execution_status 字段显示实际执行状态
  const getExecutionStatusText = (record: TestPlanCaseResult) => {
    const executionStatus = record.execution_status;
    
    // 如果有 execution_status 字段，优先使用
    if (executionStatus) {
      switch (executionStatus) {
        case 'running':
          return <Tag style={{ marginInlineEnd: 0 }} color="processing">执行中</Tag>;
        case 'completed':
          return <Tag style={{ marginInlineEnd: 0 }} color="success">已完成</Tag>;
        case 'failed':
          return <Tag style={{ marginInlineEnd: 0 }} color="error">已失败</Tag>;
        case 'cancelled':
          return <Tag style={{ marginInlineEnd: 0 }} color="default">已取消</Tag>;
        case 'error':
          return <Tag style={{ marginInlineEnd: 0 }} color="error">执行错误</Tag>;
        case 'queued':
          return <Tag style={{ marginInlineEnd: 0 }} color="warning">排队中</Tag>;
        default:
          return <Tag style={{ marginInlineEnd: 0 }} color="default">未执行</Tag>;
      }
    }
    
    // 兼容旧数据：根据 result 字段判断
    switch (record.result) {
      case 'pass':
      case 'fail':
      case 'block':
        return <Tag style={{ marginInlineEnd: 0 }} color="success">已完成</Tag>;
      case 'skip':
        return <Tag style={{ marginInlineEnd: 0 }} color="default">已跳过</Tag>;
      default:
        return <Tag style={{ marginInlineEnd: 0 }} color="default">未执行</Tag>;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}毫秒`;
    return `${(ms / 1000).toFixed(3)}秒`;
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

  // 🔥 点击日志按钮，在新标签页打开测试运行详情
  const handleViewLogs = (caseResult: TestPlanCaseResult) => {
    if (caseResult.case_type === 'ui_auto') {
      // 如果有 execution_id，在新标签页打开测试运行详情页
      window.open(`/test-runs/${caseResult.execution_id}/detail`, '_blank');
    } else {
      // 如果没有 execution_id，打开旧的 Modal（兼容功能测试）
      setCurrentCaseResult(caseResult);
      setLogModalOpen(true);
    }
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
      render: (_: unknown, record: TestPlanCaseResult) => getExecutionStatusText(record),
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
      width: 30,
      align: 'center',
      render: (name?: string) => (
        <div className="flex items-center justify-center text-sm text-gray-700">
          <span
            className="truncate max-w-[80px]" 
            title={name || execution?.executor_name || '-'}
          >
            {name || execution?.executor_name || '-'}</span>
        </div>
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
          {/* 🔥 新增：轻量刷新指示器 */}
          {isRefreshing && (
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin ml-2" />
          )}
          {/* 🔥 运行中状态标识 */}
          {execution?.status === 'running' && !isRefreshing && (
            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              执行中
            </span>
          )}
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={1700}
      styles={{
        body: {
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '16px',
        },
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

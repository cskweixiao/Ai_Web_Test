import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Calendar,
  User,
  Terminal,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';

// 🔥 使用真实的测试运行接口
interface TestRun {
  id: string;
  testCaseId: number;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'queued' | 'cancelled';
  progress: number;
  startTime: Date;
  endTime?: Date;
  duration: string;
  totalSteps: number;
  completedSteps: number;
  passedSteps: number;
  failedSteps: number;
  executor: string;
  environment: string;
  logs: Array<{
    id: string;
    timestamp: Date;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    stepId?: string;
  }>;
  screenshots: string[];
  error?: string;
}

export function TestRuns() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 🔥 从后端API加载真实的测试运行数据
  const loadTestRuns = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/tests/runs');
      const data = await response.json();
      
      if (data.success) {
        // 转换数据格式，确保时间字段正确
        const runs = (data.data || []).map((run: any) => ({
          ...run,
          startTime: new Date(run.startTime),
          endTime: run.endTime ? new Date(run.endTime) : undefined,
          logs: (run.logs || []).map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp)
          }))
        }));
        
        setTestRuns(runs);
        console.log('📊 加载测试运行数据:', runs);
      } else {
        console.error('获取测试运行失败:', data.error);
      }
    } catch (error) {
      console.error('加载测试运行失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 实时刷新测试状态
  useEffect(() => {
    loadTestRuns();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadTestRuns();
      }, 3000); // 每3秒刷新一次
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '执行中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'queued': return '队列中';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  // 🔥 计算统计数据
  const stats = {
    running: testRuns.filter(run => run.status === 'running').length,
    queued: testRuns.filter(run => run.status === 'queued').length,
    completed: testRuns.filter(run => run.status === 'completed').length,
    failed: testRuns.filter(run => run.status === 'failed').length,
  };

  // 🔥 格式化日志级别的颜色
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  // 🔥 格式化日志级别的图标
  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">测试执行结果</h2>
          <p className="text-gray-600">查看测试运行状态和断言结果</p>
        </div>
        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={clsx(
              "inline-flex items-center px-4 py-2 rounded-lg transition-colors",
              autoRefresh 
                ? "bg-green-600 text-white hover:bg-green-700" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            )}
          >
            <RefreshCw className={clsx("h-5 w-5 mr-2", autoRefresh && "animate-spin")} />
            {autoRefresh ? '自动刷新中' : '手动刷新'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={loadTestRuns}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx("h-5 w-5 mr-2", loading && "animate-spin")} />
            刷新数据
          </motion.button>
        </div>
      </div>

      {/* 🔥 真实统计数据 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse mr-2"></div>
            <div className="text-sm font-medium text-gray-600">执行中</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.running}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="h-3 w-3 bg-yellow-500 rounded-full mr-2"></div>
            <div className="text-sm font-medium text-gray-600">队列中</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.queued}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
            <div className="text-sm font-medium text-gray-600">已完成</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="h-3 w-3 bg-red-500 rounded-full mr-2"></div>
            <div className="text-sm font-medium text-gray-600">失败</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.failed}</div>
        </div>
      </div>

      {/* 🔥 空状态提示 */}
      {testRuns.length === 0 && !loading && (
        <div className="text-center py-16">
          <div className="mx-auto w-32 h-32 mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <Activity className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">暂无测试运行记录</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            还没有执行过测试用例。去"测试用例"页面运行一些测试，然后回到这里查看详细的执行结果和断言结果。
          </p>
        </div>
      )}

      {/* 🔥 真实测试运行列表 */}
      {testRuns.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">测试执行记录</h3>
            <p className="text-sm text-gray-600 mt-1">包含测试步骤和断言预期的详细结果</p>
          </div>
          <div className="divide-y divide-gray-200">
            {testRuns.map((run, index) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    {getStatusIcon(run.status)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-gray-900">{run.name}</h4>
                        <span className={clsx(
                          'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                          getStatusColor(run.status)
                        )}>
                          {getStatusText(run.status)}
                        </span>
                        {run.error && (
                          <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            错误: {run.error}
                          </span>
                        )}
                      </div>
                      
                      {run.status === 'running' && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>进度 ({run.completedSteps}/{run.totalSteps})</span>
                            <span>{run.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <motion.div
                              className="bg-blue-600 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${run.progress}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 🔥 详细的断言结果统计 */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">总步骤:</span> {run.totalSteps}
                        </div>
                        <div>
                          <span className="font-medium">已完成:</span> {run.completedSteps}
                        </div>
                        <div>
                          <span className="font-medium">通过:</span> <span className="text-green-600 font-medium">{run.passedSteps}</span>
                        </div>
                        <div>
                          <span className="font-medium">失败:</span> <span className="text-red-600 font-medium">{run.failedSteps}</span>
                        </div>
                        <div>
                          <span className="font-medium">执行者:</span> {run.executor}
                        </div>
                        <div>
                          <span className="font-medium">环境:</span> {run.environment}
                        </div>
                      </div>

                      {/* 🔥 成功率显示 */}
                      {run.totalSteps > 0 && run.status !== 'running' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>成功率</span>
                            <span className="font-medium">
                              {Math.round((run.passedSteps / run.totalSteps) * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={clsx(
                                "h-2 rounded-full transition-all",
                                run.failedSteps === 0 ? "bg-green-500" : "bg-yellow-500"
                              )}
                              style={{ 
                                width: `${Math.round((run.passedSteps / run.totalSteps) * 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <div className="text-right text-sm text-gray-600 mr-4">
                      <div>{format(run.startTime, 'MM-dd HH:mm')}</div>
                      <div className="text-xs">用时: {run.duration}</div>
                    </div>
                    
                    {/* 🔥 查看详细日志按钮 */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setSelectedRun(run);
                        setShowLogs(true);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="查看详细执行日志"
                    >
                      <Terminal className="h-4 w-4" />
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSelectedRun(run)}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="查看详情"
                    >
                      <Eye className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 🔥 详细日志模态框 - 显示断言结果 */}
      <AnimatePresence>
        {showLogs && selectedRun && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      测试执行日志: {selectedRun.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      运行ID: {selectedRun.id} | 状态: {getStatusText(selectedRun.status)}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowLogs(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              {/* 🔥 执行摘要 */}
              <div className="px-6 py-4 bg-gray-50 border-b">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{selectedRun.totalSteps}</div>
                    <div className="text-sm text-gray-600">总步骤</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{selectedRun.passedSteps}</div>
                    <div className="text-sm text-gray-600">通过</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{selectedRun.failedSteps}</div>
                    <div className="text-sm text-gray-600">失败</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{selectedRun.progress}%</div>
                    <div className="text-sm text-gray-600">完成率</div>
                  </div>
                </div>
              </div>

              {/* 🔥 详细日志 - 包含断言结果 */}
              <div className="px-6 py-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {selectedRun.logs.length > 0 ? (
                    selectedRun.logs.map((log, index) => (
                      <div
                        key={log.id || index}
                        className={clsx(
                          "p-3 rounded-lg text-sm font-mono",
                          log.level === 'success' && "bg-green-50 border-l-4 border-green-400",
                          log.level === 'error' && "bg-red-50 border-l-4 border-red-400",
                          log.level === 'warning' && "bg-yellow-50 border-l-4 border-yellow-400",
                          log.level === 'info' && "bg-blue-50 border-l-4 border-blue-400"
                        )}
                      >
                        <div className="flex items-start space-x-2">
                          <span className="flex-shrink-0 mt-0.5">
                            {getLogLevelIcon(log.level)}
                          </span>
                          <div className="flex-1">
                            <div className={clsx("font-medium", getLogLevelColor(log.level))}>
                              {log.message}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {format(log.timestamp, 'HH:mm:ss.SSS')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      暂无执行日志
                    </div>
                  )}
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowLogs(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
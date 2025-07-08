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

// 🔥 引入测试服务
import { testService } from '../services/testService';

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
      console.log('📊 正在加载测试运行数据...');
      
      // 同时尝试建立WebSocket连接
      testService.initializeWebSocket().catch(error => {
        console.warn('WebSocket连接初始化失败，将使用HTTP API轮询:', error);
      });
      
      const response = await fetch('http://localhost:3001/api/tests/runs');
      const data = await response.json();
      
      // 添加详细日志，查看原始数据
      console.log('📊 API返回的原始数据:', JSON.stringify(data, null, 2));
      
      if (data.success) {
        // 转换数据格式，确保时间字段正确
        const runs = (data.data || []).map((run: any) => {
          // 安全地转换日期
          let startTime;
          let endTime;
          
          try {
            startTime = run.startTime ? new Date(run.startTime) : null;
            // 验证日期是否有效
            if (startTime && isNaN(startTime.getTime())) {
              startTime = null;
            }
          } catch (e) {
            console.error('无效的开始时间:', run.startTime);
            startTime = null;
          }
          
          try {
            endTime = run.endTime ? new Date(run.endTime) : undefined;
            // 验证日期是否有效
            if (endTime && isNaN(endTime.getTime())) {
              endTime = undefined;
            }
          } catch (e) {
            console.error('无效的结束时间:', run.endTime);
            endTime = undefined;
          }
          
          // 补充可能缺失的字段，确保数据结构完整
          const processedRun = {
            id: run.id || `unknown-${Date.now()}`,
            testCaseId: run.testCaseId || 0,
            name: run.name || '未命名测试',
            status: run.status || 'completed',
            progress: run.progress || 0,
            startTime,
            endTime,
            duration: run.duration || '0s',
            totalSteps: run.totalSteps || 0,
            completedSteps: run.completedSteps || 0,
            passedSteps: run.passedSteps || 0,
            failedSteps: run.failedSteps || 0,
            executor: run.executor || 'System',
            environment: run.environment || 'default',
            logs: (run.logs || []).map((log: any) => {
              let timestamp;
              try {
                timestamp = log.timestamp ? new Date(log.timestamp) : null;
                if (timestamp && isNaN(timestamp.getTime())) {
                  timestamp = null;
                }
              } catch (e) {
                console.error('无效的日志时间戳:', log.timestamp);
                timestamp = null;
              }
              
              return {
                id: log.id || `log-${Date.now()}-${Math.random()}`,
                timestamp,
                level: log.level || 'info',
                message: log.message || '无日志信息',
                stepId: log.stepId
              };
            }),
            screenshots: run.screenshots || []
          };
          
          console.log('处理后的测试运行数据:', processedRun);
          return processedRun;
        });
        
        setTestRuns(runs);
        console.log('📊 成功加载测试运行数据:', runs);
      } else {
        console.error('获取测试运行失败:', data.error);
        
        // 尝试加载套件运行数据
        try {
          const suiteResponse = await fetch('http://localhost:3001/api/suites/runs');
          const suiteData = await suiteResponse.json();
          
          console.log('📊 API返回的套件运行原始数据:', JSON.stringify(suiteData, null, 2));
          
          if (suiteData.success && suiteData.data && suiteData.data.length > 0) {
            // 将套件运行数据转换为测试运行格式
            const suiteRuns = suiteData.data.map((suiteRun: any) => {
              // 安全地转换日期
              let startTime;
              let endTime;
              
              try {
                startTime = suiteRun.startTime ? new Date(suiteRun.startTime) : null;
                // 验证日期是否有效
                if (startTime && isNaN(startTime.getTime())) {
                  startTime = null;
                }
              } catch (e) {
                console.error('套件运行：无效的开始时间:', suiteRun.startTime);
                startTime = null;
              }
              
              try {
                endTime = suiteRun.endTime ? new Date(suiteRun.endTime) : undefined;
                // 验证日期是否有效
                if (endTime && isNaN(endTime.getTime())) {
                  endTime = undefined;
                }
              } catch (e) {
                console.error('套件运行：无效的结束时间:', suiteRun.endTime);
                endTime = undefined;
              }
              
              // 补充可能缺失的字段
              const processedSuiteRun = {
                id: suiteRun.id || `suite-${Date.now()}`,
                testCaseId: suiteRun.suiteId || 0,
                name: `Suite: ${suiteRun.suiteName || suiteRun.suiteId || 'Unknown'}`,
                status: suiteRun.status || 'completed',
                progress: suiteRun.progress || 0,
                startTime,
                endTime,
                duration: suiteRun.duration || '0s',
                totalSteps: suiteRun.totalCases || 0,
                completedSteps: suiteRun.completedCases || 0,
                passedSteps: suiteRun.passedCases || 0,
                failedSteps: suiteRun.failedCases || 0,
                executor: 'System',
                environment: suiteRun.environment || 'default',
                logs: [],
                screenshots: [],
                error: suiteRun.error
              };
              
              console.log('处理后的套件运行数据:', processedSuiteRun);
              return processedSuiteRun;
            });
            
            setTestRuns(suiteRuns);
            console.log('📊 成功加载套件运行数据:', suiteRuns);
          } else {
            console.warn('没有可用的测试运行或套件运行数据');
            setTestRuns([]);  // 设置为空数组，而不是null或undefined
          }
        } catch (suiteError) {
          console.error('获取套件运行数据失败:', suiteError);
          setTestRuns([]);  // 设置为空数组，以防错误
        }
      }
    } catch (error) {
      console.error('加载测试运行失败:', error);
      setTestRuns([]);  // 确保在错误情况下设置为空数组
    } finally {
      setLoading(false);
    }
  };

  // 🔥 初始化WebSocket连接
  useEffect(() => {
    // 初始化WebSocket连接
    testService.initializeWebSocket().catch(error => {
      console.error('初始化WebSocket连接失败:', error);
    });
    
    // 添加WebSocket消息监听器
    const listenerId = 'testRuns-page';
    testService.addMessageListener(listenerId, (message) => {
      console.log('📨 接收到WebSocket消息:', message);
      
      // 添加消息有效性检查
      if (!message) {
        console.warn('WebSocket消息为空');
        return;
      }
      
      // 处理测试更新消息 - 支持多种消息类型
      if (message.type === 'test_update' || message.type === 'test_complete' || 
          message.type === 'suiteUpdate' || (message as any).type === 'suiteUpdate') {
        
        console.log('收到测试/套件更新消息，将重新加载数据');
        loadTestRuns(); // 重新加载数据
      } else {
        console.log('收到未处理的WebSocket消息类型:', message.type);
      }
    });
    
    // 首次加载数据
    loadTestRuns();
    
    // 组件卸载时清理
    return () => {
      testService.removeMessageListener(listenerId);
    };
  }, []);

  // 🔥 实时刷新测试状态
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadTestRuns();
      }, 5000); // 每5秒刷新一次
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // 🔥 新增：查看测试报告详情
  const viewTestReport = async (runId: string) => {
    try {
      setLoading(true);
      const reportData = await testService.getTestReport(runId);
      console.log('📊 加载测试报告数据:', reportData);
      
      // 导航到报告页面或在弹窗中显示
      setSelectedRun(reportData.suiteRun || reportData.testRun);
      setShowLogs(true);
    } catch (error: any) {
      console.error('加载测试报告失败:', error);
      alert('加载测试报告失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

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

  // 🔥 加强版日期格式化函数
  const safeFormat = (date: Date | null | undefined, formatStr: string): string => {
    try {
      if (!date) {
        return '日期未知';
      }
      
      // 确保是Date对象
      if (!(date instanceof Date)) {
        console.warn('传入的日期不是Date对象:', date);
        const converted = new Date(date as any);
        if (isNaN(converted.getTime())) {
          return '日期无效';
        }
        date = converted;
      }
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return '日期无效';
      }
      
      // 尝试格式化日期
      return format(date, formatStr);
    } catch (error) {
      console.error('日期格式化错误:', error, date);
      return '日期格式化错误';
    }
  };

  // 添加错误边界处理
  const ErrorFallback = ({ children }: { children: React.ReactNode }) => {
    const [hasError, setHasError] = useState(false);
    
    useEffect(() => {
      const errorHandler = (event: ErrorEvent) => {
        console.error('捕获到全局错误:', event.error);
        setHasError(true);
      };
      
      window.addEventListener('error', errorHandler);
      return () => window.removeEventListener('error', errorHandler);
    }, []);
    
    if (hasError) {
      return (
        <div className="p-6 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md">
          <h3 className="text-lg font-semibold mb-2">出现错误</h3>
          <p>加载测试运行数据时发生错误，请尝试刷新页面。</p>
          <button 
            onClick={() => {
              setHasError(false);
              loadTestRuns();
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            重试加载
          </button>
        </div>
      );
    }
    
    return <>{children}</>;
  };
  
  return (
    <ErrorFallback>
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

        {/* 加载状态显示 */}
        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-lg text-gray-600">正在加载测试运行数据...</p>
          </div>
        )}

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

        {/* 测试运行列表 */}
        {testRuns.length > 0 && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">测试执行记录</h3>
              <p className="text-sm text-gray-600 mt-1">包含测试步骤和断言预期的详细结果</p>
            </div>
            <div className="divide-y divide-gray-200">
              {testRuns.map((run, index) => (
                <motion.div
                  key={run.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  {/* 运行项内容不变 */}
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
                        <div>{safeFormat(run.startTime, 'MM-dd HH:mm')}</div>
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
                        onClick={() => viewTestReport(run.id)}
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        title="查看测试报告"
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
                                {safeFormat(log.timestamp, 'HH:mm:ss.SSS')}
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
    </ErrorFallback>
  );
}
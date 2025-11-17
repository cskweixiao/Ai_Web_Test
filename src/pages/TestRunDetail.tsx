import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Terminal,
  Image as ImageIcon,
  Download,
  Loader2,
  Play,
  Square,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { testService } from '../services/testService';
import { showToast } from '../utils/toast';
import { LiveView } from '../components/LiveView';
import { EvidenceViewer } from '../components/EvidenceViewer';

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

export function TestRunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'logs' | 'live' | 'evidence'>('logs');
  const [stopping, setStopping] = useState(false);

  // 🔥 安全的日期格式化函数
  const safeFormatDate = (date: any, formatStr: string): string => {
    try {
      if (!date) return '未知';
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return '无效日期';
      return format(dateObj, formatStr);
    } catch (error) {
      console.error('日期格式化错误:', error, date);
      return '格式化错误';
    }
  };

  // 加载测试运行数据
  useEffect(() => {
    if (id) {
      loadTestRun();

      // 🔥 添加 WebSocket 监听器，实时更新测试状态
      const handleWebSocketMessage = (message: any) => {
        // 处理测试运行状态更新（匹配后端的 test_update 类型）
        if (message.type === 'test_update' && message.runId === id) {
          console.log('📡 收到测试状态更新:', message);
          loadTestRun(true); // 静默刷新数据
        }
        // 处理测试完成消息
        else if (message.type === 'test_complete' && message.runId === id) {
          console.log('📡 收到测试完成消息:', message);
          loadTestRun(true);
        }
        // 处理测试套件更新
        else if (message.type === 'suiteUpdate' && message.data?.id === id) {
          console.log('📡 收到测试套件更新:', message.data);
          loadTestRun(true);
        }
      };

      testService.addMessageListener(`test-run-detail-${id}`, handleWebSocketMessage);

      // 设置轮询更新（作为备用机制）
      const pollInterval = setInterval(() => {
        if (testRun?.status === 'running' || testRun?.status === 'queued') {
          loadTestRun(true);
        }
      }, 5000); // 增加到5秒，减少不必要的请求

      return () => {
        testService.removeMessageListener(`test-run-detail-${id}`);
        clearInterval(pollInterval);
      };
    }
  }, [id]);

  const loadTestRun = async (silent = false) => {
    if (!id) return;

    try {
      if (!silent) setLoading(true);

      // 🚀 性能优化：直接根据 ID 获取单条记录，而不是获取所有记录再过滤
      const startTime = Date.now();
      const run = await testService.getTestRunById(id);
      const duration = Date.now() - startTime;

      console.log(`⚡ loadTestRun 总耗时: ${duration}ms`);

      if (run) {
        // 🔥 确保日期字段被正确转换为 Date 对象
        const processedRun = {
          ...run,
          startTime: run.startTime ? new Date(run.startTime) : new Date(),
          endTime: run.endTime ? new Date(run.endTime) : undefined,
          logs: (run.logs || []).map(log => ({
            ...log,
            timestamp: log.timestamp ? new Date(log.timestamp) : new Date()
          }))
        };
        setTestRun(processedRun);
      } else {
        showToast.error('找不到该测试运行记录');
        navigate('/test-runs');
      }
    } catch (error) {
      console.error('加载测试运行记录失败:', error);
      if (!silent) {
        showToast.error('加载测试运行记录失败');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleStopTest = async () => {
    if (!id || !testRun || stopping) return;

    try {
      setStopping(true);
      await testService.stopTest(id);
      showToast.success('停止测试请求已发送');

      // 刷新数据
      await loadTestRun(true);
    } catch (error) {
      console.error('停止测试失败:', error);
      showToast.error('停止测试失败');
    } finally {
      setStopping(false);
    }
  };

  const getStatusIcon = (status: TestRun['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: TestRun['status']) => {
    const statusMap = {
      running: '运行中',
      completed: '已完成',
      failed: '失败',
      queued: '排队中',
      cancelled: '已取消'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: TestRun['status']) => {
    const colorMap = {
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      queued: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getLevelIcon = (level: TestRun['logs'][0]['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Terminal className="h-4 w-4 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!testRun) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-center">
          <p className="text-gray-600">找不到测试运行记录</p>
          <button
            onClick={() => navigate('/test-runs')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col">
      <div className="flex-1 flex flex-col px-4 py-3">
        {/* 顶部导航栏 */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/test-runs')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{testRun.name}</h1>
              <p className="text-sm text-gray-500 mt-1">ID: {testRun.id}</p>
            </div>
          </div>

          {(testRun.status === 'running' || testRun.status === 'queued') && (
            <button
              onClick={handleStopTest}
              disabled={stopping}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stopping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  停止中...
                </>
              ) : (
                <>
                  <Square className="h-4 w-4" />
                  停止测试
                </>
              )}
            </button>
          )}
        </div>

        {/* 状态卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3"
        >
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">状态</div>
              <div className="flex items-center gap-2">
                {getStatusIcon(testRun.status)}
                <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(testRun.status))}>
                  {getStatusText(testRun.status)}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">进度</div>
              <div className="text-xl font-bold text-gray-900">{testRun.progress}%</div>
              <div className="text-xs text-gray-600">
                {testRun.completedSteps} / {testRun.totalSteps} 步骤
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">执行结果</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">{testRun.passedSteps}</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">{testRun.failedSteps}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">执行时长</div>
              <div className="text-xl font-bold text-gray-900">{testRun.duration}</div>
              <div className="text-xs text-gray-600">
                {safeFormatDate(testRun.startTime, 'MM-dd HH:mm')}
              </div>
            </div>
          </div>

          {testRun.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-red-800">错误信息</div>
                  <div className="text-sm text-red-700 mt-1">{testRun.error}</div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* 标签页 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          <div className="border-b border-gray-200 flex-shrink-0">
            <div className="flex">
              <button
                onClick={() => setActiveTab('logs')}
                className={clsx(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'logs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <Terminal className="inline h-4 w-4 mr-1.5" />
                执行日志
              </button>
              <button
                onClick={() => setActiveTab('live')}
                className={clsx(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'live'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <Play className="inline h-4 w-4 mr-1.5" />
                实时画面
              </button>
              <button
                onClick={() => setActiveTab('evidence')}
                className={clsx(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'evidence'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <ImageIcon className="inline h-4 w-4 mr-1.5" />
                测试证据
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'logs' && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="text-lg font-semibold text-gray-900">执行日志</h3>
                  <button className="text-sm text-blue-600 hover:text-blue-700">
                    <Download className="inline h-4 w-4 mr-1" />
                    导出日志
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 flex-1 overflow-y-auto font-mono text-sm">
                  {testRun.logs.length === 0 ? (
                    <div className="text-gray-600 text-center py-8">暂无日志</div>
                  ) : (
                    testRun.logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 py-1 hover:bg-gray-800 px-2 rounded">
                        <span className="text-gray-500 flex-shrink-0">
                          {safeFormatDate(log.timestamp, 'HH:mm:ss.SSS')}
                        </span>
                        <span className="flex-shrink-0">{getLevelIcon(log.level)}</span>
                        <span className="text-gray-300 break-all">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'live' && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex-shrink-0">实时画面</h3>
                <div className="flex-1 overflow-hidden">
                  {testRun.status === 'running' ? (
                    <LiveView runId={testRun.id} />
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center h-full flex flex-col items-center justify-center">
                      <AlertCircle className="h-12 w-12 text-gray-600 mb-4" />
                      <p className="text-gray-600">测试未在运行中，无法查看实时画面</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'evidence' && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex-shrink-0">测试证据</h3>
                <div className="flex-1 overflow-auto">
                  {testRun.screenshots && testRun.screenshots.length > 0 ? (
                    <EvidenceViewer runId={testRun.id} screenshots={testRun.screenshots} />
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center h-full flex flex-col items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-gray-600 mb-4" />
                      <p className="text-gray-600">暂无测试截图</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

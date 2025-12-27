import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Square,
  RefreshCw,
  Terminal,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { Tag, Tooltip } from 'antd';

// 测试运行接口定义
interface TestRun {
  id: string;
  testCaseId: number;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'queued' | 'cancelled';
  progress: number;
  // 🔥 优化：统一使用 startedAt 和 finishedAt 字段
  // 支持 Date 对象或 ISO 字符串，因为从后端可能返回字符串
  startedAt: Date | string;
  finishedAt?: Date | string;
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
  // 🔥 新增：测试用例相关信息
  system?: string;
  module?: string;
  tags?: string[];
  priority?: 'high' | 'medium' | 'low';
  projectVersion?: string;
}

interface TestRunsTableProps {
  testRuns: TestRun[];
  selectedRunIds: Set<string>;
  stoppingTests: Set<string>;
  onStopTest: (run: TestRun) => void;
  onViewLogs: (run: TestRun) => void;
  onSelectRun: (runId: string) => void;
  onSelectAll: () => void;
  selectAll: boolean;
}

type SortField = 'name' | 'status' | 'startedAt' | 'finishedAt' | 'duration' | 'executor' | 'environment' | 'system' | 'module' | 'priority' | 'projectVersion';
type SortDirection = 'asc' | 'desc';

export function TestRunsTable({
  testRuns,
  selectedRunIds,
  stoppingTests,
  onStopTest,
  onViewLogs,
  onSelectRun,
  onSelectAll,
  selectAll
}: TestRunsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('startedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  // 状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // 状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '进行中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'queued': return '队列中';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  // 获取执行结果配置
  const getStatusConfig = (status: string | null | undefined) => {
    switch (status) {
      case 'pass':
        return { color: 'success', text: '✓ 通过', icon: '✓' };
      case 'fail':
        return { color: 'error', text: '✗ 失败', icon: '✗' };
      case 'block':
        return { color: 'warning', text: '⚠ 阻塞', icon: '⚠' };
      case 'skip':
        return { color: 'default', text: '⊘ 跳过', icon: '⊘' };
      default:
        return { color: 'default', text: '未知', icon: '' };
    }
  };

  // 安全的日期格式化
  const safeFormat = (date: Date | string | null | undefined, formatStr: string): string => {
    try {
      if (!date) {
        console.log('⚠️ safeFormat: date 为空', date);
        return '-';
      }
      
      // 🔥 修复：处理字符串类型的日期
      let dateObj: Date;
      if (typeof date === 'string') {
        // console.log('📅 safeFormat: 字符串类型', date);
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        // console.log('📅 safeFormat: Date 对象', date);
        dateObj = date;
      } else {
        console.log('⚠️ safeFormat: 未知类型', typeof date, date);
        return '-';
      }
      
      // 验证日期有效性
      if (isNaN(dateObj.getTime())) {
        console.log('❌ safeFormat: 无效日期', dateObj);
        return '-';
      }
      
      const result = format(dateObj, formatStr);
      // console.log('✅ safeFormat: 格式化成功', result);
      return result;
    } catch (error) {
      console.error('❌ 日期格式化错误:', error, 'date:', date);
      return '-';
    }
  };

  // 切换行展开
  const toggleRowExpansion = (runId: string) => {
    setExpandedRows(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(runId)) {
        newExpanded.delete(runId);
      } else {
        newExpanded.add(runId);
      }
      return newExpanded;
    });
  };

  // 排序处理
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 排序图标
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-gray-600" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 text-blue-600" />
      : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  // 排序后的数据
  const sortedTestRuns = [...testRuns].sort((a, b) => {
    let aValue: string | Date | number | string[] | undefined = a[sortField];
    let bValue: string | Date | number | string[] | undefined = b[sortField];

    // 处理 undefined 值
    if (aValue === undefined) aValue = '';
    if (bValue === undefined) bValue = '';

    // 日期字段特殊处理
    if (sortField === 'startedAt' || sortField === 'finishedAt') {
      // 🔥 修复：处理字符串类型的日期
      const aDate = aValue 
        ? (aValue instanceof Date ? aValue.getTime() : new Date(aValue as string).getTime())
        : 0;
      const bDate = bValue 
        ? (bValue instanceof Date ? bValue.getTime() : new Date(bValue as string).getTime())
        : 0;
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }

    // 优先级字段特殊处理
    if (sortField === 'priority') {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[aValue as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[bValue as keyof typeof priorityOrder] || 0;
      return sortDirection === 'asc' ? aPriority - bPriority : bPriority - aPriority;
    }

    // 字符串比较
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {/* 全选复选框 */}
              <th className="px-3 py-2 bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={onSelectAll}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  title={selectAll ? "取消全选" : "全选"}
                  aria-label={selectAll ? "取消全选" : "全选"}
                />
              </th>

              {/* 展开按钮列 */}
              <th className="px-3 py-2 bg-gray-50"></th>
              {/* ID */}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <span>ID</span>
              </th>
              {/* 项目 */}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('system')}>
                  <span>所属项目</span>
                  {/* <SortIcon field="system" /> */}
                </div>
              </th>
              {/* 版本 */}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('projectVersion')}>
                  <span>所属版本</span>
                  {/* <SortIcon field="projectVersion" /> */}
                </div>
              </th>
              {/* 模块 */}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('module')}>
                  <span>所属模块</span>
                  {/* <SortIcon field="module" /> */}
                </div>
              </th>
              {/* 测试名称 */}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('name')}>
                  <span>用例名称</span>
                  <SortIcon field="name" />
                </div>
              </th>
              {/* 标签 */}
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <span>标签</span>
              </th>
              {/* 优先级 */}
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center justify-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('priority')}>
                  <span>优先级</span>
                  {/* <SortIcon field="priority" /> */}
                </div>
              </th>
              {/* 环境 */}
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center justify-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('environment')}>
                  <span>执行环境</span>
                  {/* <SortIcon field="environment" /> */}
                </div>
              </th>
              {/* 进度 */}
              <th className="px-0 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <span>执行进度</span>
              </th>
              {/* 状态 */}
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center justify-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('status')}>
                  <span>执行状态</span>
                  {/* <SortIcon field="status" /> */}
                </div>
              </th>
              {/* 执行信息 */}
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                执行结果
              </th>
              {/* 执行者 */}
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center justify-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('executor')}>
                  <span>执行者</span>
                  {/* <SortIcon field="executor" /> */}
                </div>
              </th>
              {/* 开始时间 */}
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('startedAt')}>
                  <span>开始时间</span>
                  <SortIcon field="startedAt" />
                </div>
              </th>
              {/* 结束时间 */}
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('finishedAt')}>
                  <span>结束时间</span>
                  <SortIcon field="finishedAt" />
                </div>
              </th>
              {/* 用时 */}
              <th className="px-0 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <div className="flex items-center justify-center space-x-2 cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded" onClick={() => handleSort('duration')}>
                  <span>执行时长</span>
                  <SortIcon field="duration" />
                </div>
              </th>

              {/* 操作 - 固定右侧 */}
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-20 border-l border-gray-200 sticky-column-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <AnimatePresence>
              {sortedTestRuns.map((run, index) => (
                <React.Fragment key={run.id || index}>
                  {/* 主行 */}
                  <tr
                    className={clsx(
                      "group transition-colors duration-150",
                      selectedRunIds.has(run.id) ? "bg-blue-100" : expandedRows.has(run.id) ? "bg-blue-50" : "hover:bg-gray-50"
                    )}
                  >
                    {/* 复选框 */}
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRunIds.has(run.id)}
                        onChange={() => onSelectRun(run.id)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`选择测试运行 ${run.name}`}
                      />
                    </td>

                    {/* 展开按钮 */}
                    <td className="px-0 py-3">
                      <button
                        onClick={() => toggleRowExpansion(run.id)}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                        title={expandedRows.has(run.id) ? "收起详情" : "展开详情"}
                      >
                        {expandedRows.has(run.id)
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />
                        }
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-left">
                        <span className="text-sm text-gray-700 truncate max-w-50" title={run.testCaseId.toString() || '-'}>
                          {run.testCaseId || '-'}
                        </span>
                      </div>
                    </td>
                    {/* 项目 */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center">
                        <span className="text-sm text-gray-700 truncate max-w-50" title={run.system || '-'}>
                          {run.system || '-'}
                        </span>
                      </div>
                    </td>
                    {/* 版本 */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-left">
                        <span className="text-sm text-gray-700 truncate max-w-22" title={run.projectVersion || '-'}>
                          {run.projectVersion || '-'}
                        </span>
                      </div>
                    </td>
                    {/* 模块 */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center">
                        <span className="text-sm text-gray-700 truncate max-w-25" title={run.module || '-'}>
                          {run.module || '-'}
                        </span>
                      </div>
                    </td>
                    {/* 测试名称 */}
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium text-gray-900 max-w-xs truncate hover:text-blue-600 hover:underline"
                      style={{ maxWidth: '450px' }} 
                      title={run.name}
                      onClick={() => onViewLogs(run)}
                      >
                        {run.name}
                      </div>
                      {run.error && (
                        <div className="text-xs text-red-600 mt-1">
                          错误: {run.error}
                        </div>
                      )}
                    </td>
                    {/* 标签 */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center flex-wrap gap-1">
                        {run.tags && Array.isArray(run.tags) && run.tags.length > 0 ? (
                          run.tags.slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 border border-blue-200 truncate max-w-[80px]"
                              title={tag}
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                        {run.tags && Array.isArray(run.tags) && run.tags.length > 2 && (
                          <span className="text-xs text-gray-500">+{run.tags.length - 2}</span>
                        )}
                      </div>
                    </td>
                    {/* 优先级 */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center">
                        {run.priority ? (
                          <span className={clsx(
                            'inline-flex px-2 py-1 rounded text-xs font-medium mx-1',
                            run.priority === 'high' ? 'bg-red-100 text-red-800 border border-red-200' :
                            run.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                            'bg-gray-100 text-gray-800 border border-gray-200'
                          )}>
                            {run.priority === 'high' ? '高' : run.priority === 'medium' ? '中' : '低'}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    {/* 环境 */}
                    <td className="px-0 py-3">
                      <div className="flex items-center justify-center space-x-2 mx-3">
                      <span className="text-center flex px-2 py-1 rounded text-xs bg-gray-100 text-gray-800 border border-gray-200">
                        {run.environment}
                      </span>
                      </div>
                    </td>
                    {/* 进度 */}
                    {/* <td className="px-3 py-3 w-[100px]">
                      {run.status === 'running' ? (
                        <div className="w-full">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>{run.completedSteps}/{run.totalSteps}</span>
                            <span>{run.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-150"
                              style={{ width: `${run.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="flex items-center justify-center text-sm text-gray-600">
                          {run.completedSteps}/{run.totalSteps}
                        </span>
                      )}
                    </td> */}
                    {/* 状态 */}
                    {/* <td className="px-0 py-3 w-[120px]">
                      <div className="flex items-center justify-center space-x-2">
                        {getStatusIcon(run.status)}
                        <span className={clsx(
                          'inline-flex px-2 py-1 rounded-full text-xs font-medium border',
                          getStatusColor(run.status)
                        )}>
                          {getStatusText(run.status)}
                        </span>
                      </div>
                    </td> */}
                    {/* 执行信息 */}
                    {/* <td className="px-3 py-3 w-[180px]">
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-green-600 font-medium">{run.passedSteps}</span>
                          <span className="text-gray-400">通过</span>
                          <span className="text-red-600 font-medium">{run.failedSteps}</span>
                          <span className="text-gray-400">失败</span>
                          <span className="text-orange-600 font-medium">{run.totalSteps-run.passedSteps-run.failedSteps}</span>
                          <span className="text-gray-400">阻塞</span>
                        </div>
                      </div>
                    </td> */}
                    <td className="px-0 py-3 text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden relative">
                          <div
                            className={clsx(
                              "h-full rounded-full transition-all duration-300",
                              run.status === 'running' 
                                ? "animate-progress-shimmer bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600" 
                                : "bg-blue-500"
                            )}
                            style={{ 
                              width: `${run.progress}%`,
                              ...(run.status === 'running' ? {
                                backgroundSize: '200% 100%'
                              } : {})
                            }}
                          />
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{run.progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center flex-wrap gap-1">
                        <span className={clsx(
                          'inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800 border border-blue-200 truncate max-w-[55px]',
                          getStatusColor(run.status)
                        )}>
                          {/* {getStatusIcon(run.status)} &nbsp;  */}
                          {getStatusText(run.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-center">
                      {(() => {
                        // 根据执行状态和统计信息确定执行结果
                        let executionResult: string | null = null;
                        if (run.status === 'completed') {
                          if (run.failedSteps > 0) {
                            executionResult = 'fail';
                          } else if (run.passedSteps > 0) {
                            executionResult = 'pass';
                          } else {
                            executionResult = 'block';
                          }
                        } else if (run.status === 'running') {
                          // 执行中：不显示结果
                          executionResult = null;
                        } else if (run.status === 'failed') {
                          executionResult = 'fail';
                        }

                        const config = getStatusConfig(executionResult || null);
                        const resultText = executionResult === 'pass' ? '通过' :
                          executionResult === 'fail' ? '失败' :
                            executionResult === 'block' ? '阻塞' :
                              executionResult === 'skip' ? '跳过' : '未知';

                        return (
                          <Tooltip
                            placement="top"
                            styles={{ body: { padding: '8px', fontSize: '13px' } }}
                            title={
                              executionResult ? (
                                <div>
                                  {run.executor && (
                                    <div>执行人: {run.executor}</div>
                                  )}
                                  <div>执行状态: {run.status === 'completed' ? '已完成' : run.status === 'running' ? '进行中' : run.status === 'failed' ? '失败' : run.status === 'queued' ? '排队中' : '未知'}</div>
                                  <div>执行结果: {resultText}</div>
                                  {run.startedAt && (
                                    <div>开始时间: {safeFormat(run.startedAt, 'yyyy-MM-dd HH:mm:ss')}</div>
                                  )}
                                  {run.finishedAt && (
                                    <div>结束时间: {safeFormat(run.finishedAt, 'yyyy-MM-dd HH:mm:ss')}</div>
                                  )}
                                  
                                </div>
                              ) : run.status === 'running' ? '执行中，暂无结果' : '暂无执行结果'
                            }
                          >
                            <Tag style={{ marginInlineEnd: 0, padding: '1px 8px' }} color={config.color}>{config.text}</Tag>
                          </Tooltip>
                        );
                      })()}
                    </td>
                    {/* 执行者 */}
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center text-sm text-gray-600">
                        <User className="h-3 w-3 mr-1" />
                        <span className="max-w-20 truncate" title={run.executor}>{run.executor}</span>
                      </div>
                    </td>
                    {/* 开始时间 */}
                    <td className="px-2 py-3">
                      <div className="flex items-center  text-sm text-gray-600">
                        <Clock className="h-3 w-3 mr-1" />
                        <span className="truncate min-w-20 max-w-32" title={safeFormat(run.startedAt, 'yyyy-MM-dd HH:mm:ss')}>
                          {safeFormat(run.startedAt, 'yyyy-MM-dd HH:mm:ss')}
                        </span>
                      </div>
                    </td>
                    {/* 结束时间 */}
                    <td className="px-2 py-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-3 w-3 mr-1" />
                        <span className="truncate min-w-20 max-w-32" title={safeFormat(run.finishedAt, 'yyyy-MM-dd HH:mm:ss')}>
                          {safeFormat(run.finishedAt, 'yyyy-MM-dd HH:mm:ss')}
                        </span>
                      </div>
                    </td>
                    {/* 执行时长 */}
                    <td className="px-2 py-3">
                      <span className="flex items-center justify-center text-sm text-gray-600 min-w-20">{run.duration}</span>
                    </td>
                    {/* 操作 - 固定右侧 */}
                    <td className={clsx(
                      "px-4 py-3 text-left sticky right-0 z-10 border-l border-gray-200 transition-colors sticky-column-right",
                      expandedRows.has(run.id) ? "bg-blue-50" : "bg-white group-hover:bg-gray-50"
                    )}>
                      <div className="flex items-center space-x-2">
                        {(run.status === 'running' || run.status === 'queued') && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onStopTest(run)}
                            disabled={stoppingTests.has(run.id)}
                            className={clsx(
                              "p-1.5 rounded transition-colors",
                              stoppingTests.has(run.id)
                                ? "text-orange-500 cursor-not-allowed bg-orange-50"
                                : "text-gray-600 hover:text-red-600 hover:bg-red-50"
                            )}
                            title={stoppingTests.has(run.id) ? "正在停止..." : "停止测试"}
                          >
                            {stoppingTests.has(run.id) ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </motion.button>
                        )}

                        {run.status !== 'queued' && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onViewLogs(run)}
                            className="p-1.5 rounded text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="查看详细执行日志"
                          >
                            <Terminal className="h-4 w-4" />
                          </motion.button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* 展开行 */}
                  {expandedRows.has(run.id) && (
                    <tr className="bg-blue-50">
                      <td colSpan={16} className="px-6 py-3">
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="grid grid-cols-2 gap-4"
                        >
                          {/* 测试ID */}
                          <div className="bg-white rounded-lg p-3 border border-blue-200">
                            <h4 className="text-xs font-medium text-gray-500 mb-1">运行ID</h4>
                            <p className="text-sm text-gray-900 font-mono">{run.id}</p>
                          </div>

                          {/* 测试用例ID */}
                          <div className="bg-white rounded-lg p-3 border border-blue-200">
                            <h4 className="text-xs font-medium text-gray-500 mb-1">测试用例ID</h4>
                            <p className="text-sm text-gray-900">{run.testCaseId}</p>
                          </div>

                          {/* 结束时间 */}
                          {run.finishedAt && (
                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                              <h4 className="text-xs font-medium text-gray-500 mb-1">结束时间</h4>
                              <p className="text-sm text-gray-900">{safeFormat(run.finishedAt, 'yyyy-MM-dd HH:mm:ss')}</p>
                            </div>
                          )}

                          {/* 截图数量 */}
                          {run.screenshots && run.screenshots.length > 0 && (
                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                              <h4 className="text-xs font-medium text-gray-500 mb-1">截图数量</h4>
                              <p className="text-sm text-gray-900">{run.screenshots.length} 张</p>
                            </div>
                          )}
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
    </div>
  );
}


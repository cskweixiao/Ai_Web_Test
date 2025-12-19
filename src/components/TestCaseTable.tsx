import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Edit3,
  Trash2,
  Tag,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronRight as ChevronRightIcon,
  ChevronsRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { TestCase } from '../types/test';
import { parseStepsText } from '../utils/stepConverter';

interface TestCaseTableProps {
  testCases: TestCase[];
  onRunTest: (testCase: TestCase) => void;
  onEditTestCase: (testCase: TestCase) => void;
  onDeleteTestCase: (testCase: TestCase) => void;
  runningTestId: number | null;
  loading?: boolean;
  // 分页相关props
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  // 🔥 新增：批量选择相关props
  selectedIds?: number[];
  onSelectionChange?: (selectedIds: number[]) => void;
}

type SortField = 'name' | 'priority' | 'status' | 'created' | 'updated' | 'lastRun' | 'success_rate' | 'author' | 'system' | 'module';
type SortDirection = 'asc' | 'desc';

export function TestCaseTable({
  testCases,
  onRunTest,
  onEditTestCase,
  onDeleteTestCase,
  runningTestId,
  pagination,
  onPageChange,
  onPageSizeChange,
  selectedIds = [],
  onSelectionChange
}: TestCaseTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 🔥 新增：全选/取消全选逻辑
  const allSelected = testCases.length > 0 && testCases.every(tc => selectedIds.includes(tc.id));
  const someSelected = testCases.some(tc => selectedIds.includes(tc.id)) && !allSelected;

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      // 取消全选
      onSelectionChange([]);
    } else {
      // 全选当前页
      onSelectionChange(testCases.map(tc => tc.id));
    }
  };

  const handleSelectOne = (testCaseId: number) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(testCaseId)) {
      // 取消选中
      onSelectionChange(selectedIds.filter(id => id !== testCaseId));
    } else {
      // 选中
      onSelectionChange([...selectedIds, testCaseId]);
    }
  };

  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'disabled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityText = (priority: string | undefined) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '中';
    }
  };

  const getStatusText = (status: string | undefined) => {
    switch (status) {
      case 'active': return '启用';
      case 'draft': return '草稿';
      case 'disabled': return '禁用';
      default: return '启用';
    }
  };

  const formatDateTime = (dateTime: string | undefined) => {
    if (!dateTime) return '-';
    try {
      const date = new Date(dateTime);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateTime;
    }
  };

  const toggleRowExpansion = (testCaseId: number) => {
    setExpandedRows(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(testCaseId)) {
        newExpanded.delete(testCaseId);
      } else {
        newExpanded.add(testCaseId);
      }
      return newExpanded;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTestCases = [...testCases].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    // Handle updated field
    if (sortField === 'updated') {
      aValue = a.updated;
      bValue = b.updated;
    } else {
      aValue = a[sortField];
      bValue = b[sortField];
    }

    // Handle undefined values
    if (aValue === undefined) aValue = '';
    if (bValue === undefined) bValue = '';

    // Special handling for different field types
    if (sortField === 'success_rate') {
      aValue = aValue || 0;
      bValue = bValue || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    if (sortField === 'priority') {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      aValue = priorityOrder[aValue as keyof typeof priorityOrder] || 2;
      bValue = priorityOrder[bValue as keyof typeof priorityOrder] || 2;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Special handling for date fields
    if (sortField === 'created' || sortField === 'updated' || sortField === 'lastRun') {
      const aDate = aValue ? new Date(aValue).getTime() : 0;
      const bDate = bValue ? new Date(bValue).getTime() : 0;
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }

    // String comparison for other fields
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-600" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  if (testCases.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">暂无测试用例数据</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 表格容器 - 支持横向滚动 */}
      <div className="relative overflow-x-auto">
        <style>{`
          /* 固定列阴影效果 */
          .sticky-column-left {
            box-shadow: 2px 0 5px -2px rgba(0, 0, 0, 0.1);
          }
          .sticky-column-right {
            box-shadow: -2px 0 5px -2px rgba(0, 0, 0, 0.1);
          }
          /* 用例名称列最大宽度限制 */
          .test-case-name-column {
            width: 180px !important;
            min-width: 180px !important;
            max-width: 420px !important;
            overflow: hidden;
          }
          /* 滚动条样式 */
          .table-container::-webkit-scrollbar {
            height: 8px;
          }
          .table-container::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
          }
          .table-container::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .table-container::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>
        <div className="overflow-x-auto table-container" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1400px' }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {/* 🔥 新增：复选框列 - 40px */}
              {onSelectionChange && (
                <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 border-r border-gray-200 sticky-column-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someSelected;
                      }
                    }}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    title={allSelected ? "取消全选" : "全选当前页"}
                  />
                </th>
              )}
              
              {/* 固定列：展开按钮 - 40px */}
              <th className={clsx(
                "z-20 bg-gray-50 w-10 px-2 py-3 border-r border-gray-200 sticky-column-left",
                onSelectionChange ? "sticky left-10" : "sticky left-0"
              )}></th>
              
              {/* 固定列：所属项目 - 120px */}
              {/* <th 
                className="sticky left-[40px] z-20 bg-gray-50 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 sticky-column-left"
                style={{ width: '120px', minWidth: '120px' }}
              >
                所属项目
              </th> */}

              {/* 固定列：所属模块 - 120px */}
              {/* <th 
                className="sticky left-[160px] z-20 bg-gray-50 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 sticky-column-left"
                style={{ width: '120px', minWidth: '120px' }}
              >
                所属模块
              </th> */}

              {/* 固定列：用例名称 - 280px */}
              {/* <th
                className="sticky left-[280px] z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-200 sticky-column-left"
                style={{ width: '280px', minWidth: '280px' }}
                // onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-2">
                  <span>用例名称</span>
                  <SortIcon field="name" />
                </div>
              </th> */}

              {/* 滚动列区域 */}
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '80px', minWidth: '80px' }}>
              所属项目
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '80px', minWidth: '80px' }}>
              所属版本
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '80px', minWidth: '80px' }}>
              所属模块
              </th>
              <th
               className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 test-case-name-column"
               onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span className="truncate">用例名称</span>
                  <SortIcon field="name" />
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '80px', minWidth: '80px' }}>
                标签
              </th>
              <th
                className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                // onClick={() => handleSort('priority')}
                style={{ width: '80px', minWidth: '80px' }}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>优先级</span>
                  {/* <SortIcon field="priority" /> */}
                </div>
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '80px', minWidth: '80px' }}>
                执行状态
              </th>
              <th
                className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                // onClick={() => handleSort('success_rate')}
                style={{ width: '80px', minWidth: '80px' }}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>通过率</span>
                  {/* <SortIcon field="success_rate" /> */}
                </div>
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '80px', minWidth: '80px' }}>
                执行结果
              </th>
              
              <th
                className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                // onClick={() => handleSort('status')}
                style={{ width: '80px', minWidth: '80px' }}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>状态</span>
                  {/* <SortIcon field="status" /> */}
                </div>
              </th>
              <th 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                // onClick={() => handleSort('author')}
                style={{ width: '80px', minWidth: '80px' }}
              >
                <div className="flex items-center space-x-1">
                  <span>创建者</span>
                  {/* <SortIcon field="author" /> */}
                </div>
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                // onClick={() => handleSort('created')}
                style={{ width: '120px', minWidth: '120px' }}
              >
                <div className="flex items-center space-x-1">
                  <span>创建时间</span>
                  {/* <SortIcon field="created" /> */}
                </div>
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                // onClick={() => handleSort('updated')}
                style={{ width: '120px', minWidth: '120px' }}
              >
                <div className="flex items-center space-x-1">
                  <span>更新时间</span>
                  {/* <SortIcon field="updated" /> */}
                </div>
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                // onClick={() => handleSort('lastRun')}
                style={{ width: '120px', minWidth: '120px' }}
              >
                <div className="flex items-center space-x-1">
                  <span>最后运行</span>
                  {/* <SortIcon field="lastRun" /> */}
                </div>
              </th>

              {/* 固定列：操作 - 120px */}
              <th 
                className="sticky right-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200 sticky-column-right"
                style={{ width: '120px', minWidth: '120px' }}
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <AnimatePresence>
              {sortedTestCases.map((testCase, index) => (
                <React.Fragment key={testCase.id}>
                {/* Main Row */}
                <motion.tr
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={clsx(
                    "group transition-colors",
                    selectedIds.includes(testCase.id) ? "bg-blue-100" : expandedRows.has(testCase.id) ? "bg-blue-50" : "hover:bg-gray-50"
                  )}
                >
                  {/* 🔥 新增：复选框 */}
                  {onSelectionChange && (
                    <td className={clsx(
                      "sticky left-0 z-10 px-3 py-2 border-r border-gray-200 transition-colors sticky-column-left",
                      selectedIds.includes(testCase.id) ? "bg-blue-100" : expandedRows.has(testCase.id) ? "bg-blue-50" : "bg-white group-hover:bg-gray-50"
                    )}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(testCase.id)}
                        onChange={() => handleSelectOne(testCase.id)}
                        className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  
                  {/* 固定列：展开按钮 */}
                  <td className={clsx(
                    "z-10 px-2 py-3 border-r border-gray-200 transition-colors sticky-column-left",
                    onSelectionChange ? "sticky left-10" : "sticky left-0",
                    selectedIds.includes(testCase.id) ? "bg-blue-100" : expandedRows.has(testCase.id) ? "bg-blue-50" : "bg-white group-hover:bg-gray-50"
                  )}>
                    <button
                      onClick={() => toggleRowExpansion(testCase.id)}
                      className="text-gray-600 hover:text-blue-600 transition-colors"
                      title={expandedRows.has(testCase.id) ? "收起详情" : "展开详情"}
                    >
                      {expandedRows.has(testCase.id)
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </button>
                  </td>

                  {/* 固定列：所属项目 */}
                  {/* <td className={clsx(
                    "sticky left-[40px] z-10 px-3 py-3 border-r border-gray-200 transition-colors sticky-column-left",
                    expandedRows.has(testCase.id) ? "bg-blue-50" : "bg-white group-hover:bg-gray-50"
                  )}>
                    <div className="text-sm text-gray-900 truncate" title={testCase.system}>
                      {testCase.system || '-'}
                    </div>
                  </td> */}

                  {/* 固定列：所属模块 */}
                  {/* <td className={clsx(
                    "sticky left-[160px] z-10 px-3 py-3 border-r border-gray-200 transition-colors sticky-column-left",
                    expandedRows.has(testCase.id) ? "bg-blue-50" : "bg-white group-hover:bg-gray-50"
                  )}>
                    <div className="text-sm text-gray-900 truncate" title={testCase.module}>
                      {testCase.module || '-'}
                    </div>
                  </td> */}

                  {/* 固定列：用例名称 */}
                  {/* <td className={clsx(
                    "sticky left-[280px] z-10 px-4 py-3 border-r border-gray-200 transition-colors sticky-column-left",
                    expandedRows.has(testCase.id) ? "bg-blue-50" : "bg-white group-hover:bg-gray-50"
                  )}>
                    <div className="text-sm font-medium text-gray-900 truncate" title={testCase.name}>
                      {testCase.name}
                    </div>
                  </td> */}

                  {/* 滚动列区域 */}
                  <td className="px-3 py-3">
                    <div className="flex items-center text-sm text-gray-900 truncate">
                      <span className="truncate">{testCase.system}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center text-sm text-gray-900 truncate">
                      <span className="truncate">{testCase.projectVersion || '-'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center text-sm text-gray-900 truncate">
                      <span className="truncate">{testCase.module}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 test-case-name-column">
                    <div className="text-sm font-medium text-gray-900 truncate" title={testCase.name}>
                      {testCase.name}
                    </div>
                  </td>
                  {/* Tags */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {testCase.tags && testCase.tags.length > 0 ? (
                        <>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800 border border-blue-200 truncate max-w-[80px]" title={testCase.tags[0]}>
                            {testCase.tags[0]}
                          </span>
                          {testCase.tags.length > 1 && (
                            <span className="text-xs text-gray-500">+{testCase.tags.length - 1}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-600 text-sm">-</span>
                      )}
                    </div>
                  </td>
                  
                  {/* Priority */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <span className={clsx(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border',
                        getPriorityColor(testCase.priority)
                      )}>
                        {getPriorityText(testCase.priority)}
                      </span>
                    </div>
                  </td>
                  {/* 执行状态 */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center">
                      {(testCase as any).executionStatus ? (
                        <span className={clsx(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap',
                          (testCase as any).executionStatus === 'running' && 'bg-blue-100 text-blue-800 border-blue-200',
                          (testCase as any).executionStatus === 'completed' && 'bg-green-100 text-green-800 border-green-200',
                          (testCase as any).executionStatus === 'failed' && 'bg-red-100 text-red-800 border-red-200',
                          (testCase as any).executionStatus === 'pending' && 'bg-yellow-100 text-yellow-800 border-yellow-200',
                          (testCase as any).executionStatus === 'cancelled' && 'bg-gray-100 text-gray-800 border-gray-200'
                        )}>
                          {(testCase as any).executionStatus === 'running' && '运行中'}
                          {(testCase as any).executionStatus === 'completed' && '已完成'}
                          {(testCase as any).executionStatus === 'failed' && '失败'}
                          {(testCase as any).executionStatus === 'pending' && '等待中'}
                          {(testCase as any).executionStatus === 'cancelled' && '已取消'}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-sm">-</span>
                      )}
                    </div>
                  </td>
                  {/* Success Rate */}
                  <td className="px-3 py-3 text-center">
                    {testCase.lastRun && testCase.lastRun !== '' && testCase.success_rate !== undefined && testCase.success_rate !== null ? (
                      <span className="text-xs text-gray-900 font-medium">
                        {testCase.success_rate}%
                      </span>
                    ) : (
                      <span className="text-gray-600 text-sm">-</span>
                    )}
                  </td>
                  {/* 执行结果 */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center">
                      {(testCase as any).executionResult ? (
                        <span className={clsx(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap',
                          (testCase as any).executionResult === 'pass' && 'bg-green-100 text-green-800 border-green-200',
                          (testCase as any).executionResult === 'fail' && 'bg-red-100 text-red-800 border-red-200',
                          (testCase as any).executionResult === 'skip' && 'bg-gray-100 text-gray-800 border-gray-200'
                        )}>
                          {(testCase as any).executionResult === 'pass' && '通过'}
                          {(testCase as any).executionResult === 'fail' && '不通过'}
                          {(testCase as any).executionResult === 'skip' && '跳过'}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-sm">-</span>
                      )}
                    </div>
                  </td>
                  
                  
                  {/* Status */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <span className={clsx(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border',
                        getStatusColor(testCase.status)
                      )}>
                        {getStatusText(testCase.status)}
                      </span>
                    </div>
                  </td>
                  {/* Author */}
                  <td className="px-3 py-3">
                    <div className="flex items-center text-sm text-gray-600 truncate">
                      <User className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{testCase.author}</span>
                    </div>
                  </td>
                  
                  {/* Created Time */}
                  <td className="px-3 py-3">
                    <div className="flex items-center text-xs text-gray-500 ">
                      <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate" title={formatDateTime(testCase.created)}>
                        {formatDateTime(testCase.created)}
                      </span>
                    </div>
                  </td>
                  
                  {/* Updated Time */}
                  <td className="px-3 py-3">
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate" title={formatDateTime(testCase.updated)}>
                        {formatDateTime(testCase.updated)}
                      </span>
                    </div>
                  </td>

                  {/* Last Run */}
                  <td className="px-3 py-3">
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate" title={testCase.lastRun || '-'}>
                        {testCase.lastRun || '-'}
                      </span>
                    </div>
                  </td>

                  {/* 固定列：操作 */}
                  <td className={clsx(
                    "sticky right-0 z-10 px-4 py-3 border-l border-gray-200 transition-colors sticky-column-right",
                    expandedRows.has(testCase.id) ? "bg-blue-50" : "bg-white group-hover:bg-gray-50"
                  )}>
                    <div className="flex items-center justify-start space-x-1">
                      <button
                        onClick={() => onRunTest(testCase)}
                        disabled={runningTestId === testCase.id}
                        className={clsx(
                          "p-1.5 rounded transition-colors",
                          runningTestId === testCase.id
                            ? "text-blue-600 cursor-not-allowed bg-blue-100"
                            : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                        )}
                        title={runningTestId === testCase.id ? "执行中..." : "运行测试"}
                      >
                        {runningTestId === testCase.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onEditTestCase(testCase)}
                        className="p-1.5 rounded text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors"
                        title="编辑"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDeleteTestCase(testCase)}
                        className="p-1.5 rounded text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>

                {/* Expanded Row */}
                {expandedRows.has(testCase.id) && (
                  <tr className="bg-blue-50 border-t-0">
                    <td colSpan={onSelectionChange ? 15 : 16} className="px-4 py-4">
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4 w-full max-w-full"
                      >
                        {/* Test Steps - 操作步骤和预期结果 */}
                        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 w-full min-w-0">
                          {/* 操作步骤 */}
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                              <Tag className="h-4 w-4 mr-1" />
                              操作步骤
                            </h4>
                            <div className="bg-white rounded-lg p-3 border border-blue-200 max-h-64 overflow-y-auto">
                              {(() => {
                                const stepsData = testCase.stepsData || (testCase.steps ? parseStepsText(testCase.steps) : []);
                                if (stepsData.length > 0) {
                                  return (
                                    <div className="space-y-2">
                                      {stepsData.map((step, index) => (
                                        <div key={step.id || index} className="text-sm text-gray-700 break-words">
                                          <div className="font-medium text-gray-900 mb-1 break-words">
                                            {step.order || index + 1}. {step.action}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                }
                                return (
                                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                                    {testCase.steps || '暂无步骤描述'}
                                  </pre>
                                );
                              })()}
                            </div>
                          </div>

                          {/* 预期结果 */}
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">预期结果</h4>
                            <div className="bg-white rounded-lg p-3 border border-blue-200 max-h-64 overflow-y-auto">
                              {(() => {
                                const stepsData = testCase.stepsData || (testCase.steps ? parseStepsText(testCase.steps) : []);
                                if (stepsData.length > 0) {
                                  return (
                                    <div className="space-y-2">
                                      {stepsData.map((step, index) => (
                                        <div key={step.id || index} className="text-sm text-gray-700 break-words">
                                          <div className="font-medium text-gray-900 mb-1 break-words">
                                            {step.order || index + 1}. {step.expected || '无预期结果'}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                }
                                return (
                                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                                    暂无预期结果
                                  </pre>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Assertions - 断言预期 */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">断言预期</h4>
                          <div className="bg-white rounded-lg p-3 border border-blue-200 max-h-64 overflow-y-auto">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                              {testCase.assertions || '暂无断言预期'}
                            </pre>
                          </div>
                        </div>

                        {/* Metadata */}
                        {/* {(testCase.created || testCase.tags?.length) && (
                          <div className="lg:col-span-2">
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600 bg-white rounded-lg p-3 border border-blue-200">
                              {testCase.created && (
                                <div className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  创建时间: {testCase.created}
                                </div>
                              )}
                              {testCase.updated && (
                                <div className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  更新时间: {testCase.updated}
                                </div>
                              )}
                              {testCase.tags && testCase.tags.length > 1 && (
                                <div className="flex items-center flex-wrap gap-1">
                                  <Tag className="h-3 w-3 mr-1" />
                                  <span>所有标签:</span>
                                  {testCase.tags.map((tag, tagIndex) => (
                                    <span
                                      key={tagIndex}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )} */}
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
      </div>

      {/* 分页控件 */}
      {pagination && (onPageChange || onPageSizeChange) && (
        <div className="flex justify-between items-center  px-6 py-4 border-t border-gray-200 bg-gray-50">
          {/* 中间：页码信息 */}
          {/* <div className="flex  space-x-4">
            <span className="text-sm text-gray-700">
              显示第 {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)} 到{' '}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} 条，共 {pagination.total} 条
            </span>
          </div> */}
          <div className="text-sm text-gray-500">
            共 <span className="font-semibold text-gray-700">{pagination.total}</span> 条记录，
            第 <span className="font-semibold text-gray-700">{pagination.page}</span> / <span className="font-semibold text-gray-700">{pagination.totalPages}</span> 页
          </div>
          <div className="flex  space-x-4">
          {/* 右侧：分页按钮 */}
          {onPageChange && (
            <div className="flex items-center space-x-1">
              {/* 第一页 */}
              <button
                onClick={() => onPageChange(1)}
                disabled={pagination.page === 1}
                className={clsx(
                  'p-2 rounded',
                  pagination.page === 1
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
                title="第一页"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>

              {/* 上一页 */}
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className={clsx(
                  'p-2 rounded',
                  pagination.page === 1
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
                title="上一页"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* 页码输入框 */}
              <div className="flex items-center space-x-2 px-2">
                <input
                  type="number"
                  min={1}
                  max={pagination.totalPages}
                  value={pagination.page}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= pagination.totalPages) {
                      onPageChange(page);
                    }
                  }}
                  className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">/ {pagination.totalPages}</span>
              </div>

              {/* 下一页 */}
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className={clsx(
                  'p-2 rounded',
                  pagination.page === pagination.totalPages
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
                title="下一页"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>

              {/* 最后一页 */}
              <button
                onClick={() => onPageChange(pagination.totalPages)}
                disabled={pagination.page === pagination.totalPages}
                className={clsx(
                  'p-2 rounded',
                  pagination.page === pagination.totalPages
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
                title="最后一页"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* 左侧：每页条数选择器 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">每页显示</span>
            {onPageSizeChange && (
              <select
                value={pagination.pageSize}
                onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ width: '80px' }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            )}
            <span className="text-sm text-gray-700">条</span>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
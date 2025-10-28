import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Bot,
  Edit3,
  Trash2,
  Tag as TagIcon,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { functionalTestCaseService } from '../services/functionalTestCaseService';
import { showToast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';

/**
 * 功能测试用例列表页面
 */
export function FunctionalTestCases() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [testCases, setTestCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    system: '',
    module: '',
    source: '',
    priority: '',
    status: '',
    tag: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // 排序状态
  type SortField = 'id' | 'name' | 'priority' | 'status' | 'created_at' | 'updated_at';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const result = await functionalTestCaseService.getList({
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters
      });

      setTestCases(result.data || []);
      setPagination(prev => ({
        ...prev,
        total: result.pagination?.total || 0,
        totalPages: result.pagination?.totalPages || 0
      }));
    } catch (error: any) {
      showToast.error('加载失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination.page, pagination.pageSize, filters]);

  // 删除用例
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`确定要删除测试用例"${name}"吗？`)) {
      return;
    }

    try {
      await functionalTestCaseService.delete(id);
      showToast.success('删除成功');
      loadData();
    } catch (error: any) {
      showToast.error('删除失败：' + error.message);
    }
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

  const sortedTestCases = [...testCases].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (aValue === undefined) aValue = '';
    if (bValue === undefined) bValue = '';

    if (sortField === 'priority') {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      aValue = priorityOrder[aValue as keyof typeof priorityOrder] || 2;
      bValue = priorityOrder[bValue as keyof typeof priorityOrder] || 2;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    if (sortField === 'created_at' || sortField === 'updated_at') {
      const aDate = aValue ? new Date(aValue).getTime() : 0;
      const bDate = bValue ? new Date(bValue).getTime() : 0;
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }

    if (sortField === 'status') {
      const statusOrder = { PUBLISHED: 3, DRAFT: 2, ARCHIVED: 1 };
      aValue = statusOrder[aValue as keyof typeof statusOrder] || 2;
      bValue = statusOrder[bValue as keyof typeof statusOrder] || 2;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // 展开/收起行
  const toggleRowExpansion = (id: number) => {
    setExpandedRows(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return newExpanded;
    });
  };

  // 优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // 来源颜色
  const getSourceColor = (source: string) => {
    return source === 'AI_GENERATED'
      ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
      : 'bg-purple-100 text-purple-800 border-purple-200';
  };

  // 状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'bg-green-100 text-green-800 border-green-200';
      case 'DRAFT': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ARCHIVED': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // 状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return '已发布';
      case 'DRAFT': return '草稿';
      case 'ARCHIVED': return '已归档';
      default: return status;
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* 页面标题和操作按钮 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">功能测试用例</h1>
          <p className="text-sm text-gray-500 mt-1">管理和维护功能测试用例库</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/functional-test-cases/generator')}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600
                     text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all
                     shadow-md hover:shadow-lg"
          >
            <Bot className="w-4 h-4 mr-2" />
            AI生成器
          </button>
          <button
            onClick={() => showToast.info('手动创建功能待实现')}
            className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg
                     hover:bg-gray-50 transition-colors border border-gray-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            手动创建
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索用例名称或描述..."
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && setPagination(prev => ({ ...prev, page: 1 }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'inline-flex items-center px-4 py-2 rounded-lg transition-colors border',
              showFilters
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
          >
            <Filter className="w-4 h-4 mr-2" />
            筛选
          </button>
          <button
            onClick={() => {
              setFilters({ search: '', system: '', module: '', source: '', priority: '', status: '', tag: '' });
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="inline-flex items-center px-4 py-2 text-gray-600 hover:text-gray-900
                     border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4 mr-2" />
            重置
          </button>
        </div>

        {/* 展开的筛选项 */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-3 pt-3 border-t border-gray-200">
                <select
                  value={filters.system}
                  onChange={e => setFilters(prev => ({ ...prev, system: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">全部系统</option>
                  <option value="电商系统">电商系统</option>
                  <option value="OA系统">OA系统</option>
                  <option value="CRM系统">CRM系统</option>
                </select>

                <select
                  value={filters.module}
                  onChange={e => setFilters(prev => ({ ...prev, module: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">全部模块</option>
                </select>

                <select
                  value={filters.priority}
                  onChange={e => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">全部优先级</option>
                  <option value="critical">紧急</option>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>

                <select
                  value={filters.status}
                  onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">全部状态</option>
                  <option value="PUBLISHED">已发布</option>
                  <option value="DRAFT">草稿</option>
                  <option value="ARCHIVED">已归档</option>
                </select>

                <select
                  value={filters.source}
                  onChange={e => setFilters(prev => ({ ...prev, source: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">全部来源</option>
                  <option value="AI_GENERATED">AI生成</option>
                  <option value="MANUAL">手动创建</option>
                </select>

                <input
                  type="text"
                  placeholder="标签筛选..."
                  value={filters.tag}
                  onChange={e => setFilters(prev => ({ ...prev, tag: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-500 mt-2">加载中...</p>
          </div>
        ) : testCases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">暂无测试用例数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>ID</span>
                      <SortIcon field="id" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>用例名称</span>
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    系统/模块
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>优先级</span>
                      <SortIcon field="priority" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>状态</span>
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    来源
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    标签
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    创建者
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>创建时间</span>
                      <SortIcon field="created_at" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('updated_at')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>更新时间</span>
                      <SortIcon field="updated_at" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <AnimatePresence>
                  {sortedTestCases.map((testCase) => (
                    <React.Fragment key={testCase.id}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <button
                            onClick={() => toggleRowExpansion(testCase.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {expandedRows.has(testCase.id) ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{testCase.id}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="font-medium">{testCase.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{testCase.system || '-'}</div>
                          <div className="text-xs text-gray-400">{testCase.module || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-md border',
                            getPriorityColor(testCase.priority)
                          )}>
                            {testCase.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-md border',
                            getStatusColor(testCase.status)
                          )}>
                            {getStatusText(testCase.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-md border',
                            getSourceColor(testCase.source)
                          )}>
                            {testCase.source === 'AI_GENERATED' ? 'AI生成' : '手动创建'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {testCase.tags ? (
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {testCase.tags.split(',').slice(0, 2).map((tag: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 text-xs font-medium
                                           bg-blue-100 text-blue-800 rounded"
                                >
                                  {tag.trim()}
                                </span>
                              ))}
                              {testCase.tags.split(',').length > 2 && (
                                <span className="text-xs text-gray-400">+{testCase.tags.split(',').length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1 text-gray-400" />
                            {testCase.users?.username || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-gray-400" />
                            {formatDate(testCase.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-gray-400" />
                            {formatDate(testCase.updated_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => showToast.info('查看详情功能待实现')}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              查看
                            </button>
                            <button
                              onClick={() => showToast.info('编辑功能待实现')}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(testCase.id, testCase.name)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>

                      {/* 展开的详情行 */}
                      <AnimatePresence>
                        {expandedRows.has(testCase.id) && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-gray-50"
                          >
                            <td colSpan={11} className="px-6 py-4">
                              <div className="space-y-3">
                                {testCase.description && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-1">描述</h4>
                                    <p className="text-sm text-gray-600">{testCase.description}</p>
                                  </div>
                                )}
                                {testCase.preconditions && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-1">前置条件</h4>
                                    <div className="text-sm text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">
                                      {testCase.preconditions}
                                    </div>
                                  </div>
                                )}
                                {testCase.steps && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-1">测试步骤</h4>
                                    <div className="text-sm text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">
                                      {testCase.steps}
                                    </div>
                                  </div>
                                )}
                                {testCase.assertions && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-1">断言/预期结果</h4>
                                    <div className="text-sm text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">
                                      {testCase.assertions}
                                    </div>
                                  </div>
                                )}
                                {testCase.test_data && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-1">测试数据</h4>
                                    <div className="text-sm text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">
                                      {testCase.test_data}
                                    </div>
                                  </div>
                                )}
                                {testCase.tags && testCase.tags.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-1">标签</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {testCase.tags.map((tag: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center px-2 py-1 text-xs font-medium
                                                   bg-blue-100 text-blue-800 rounded-md"
                                        >
                                          <TagIcon className="h-3 w-3 mr-1" />
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页器 */}
      {testCases.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            共 <span className="font-medium">{pagination.total}</span> 条记录，
            第 <span className="font-medium">{pagination.page}</span> / {pagination.totalPages} 页
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
              disabled={pagination.page === 1}
              className={clsx(
                'px-3 py-2 rounded-lg border transition-colors',
                pagination.page === 1
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              首页
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className={clsx(
                'px-3 py-2 rounded-lg border transition-colors',
                pagination.page === 1
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              上一页
            </button>
            <span className="px-4 py-2 text-sm text-gray-700">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className={clsx(
                'px-3 py-2 rounded-lg border transition-colors',
                pagination.page >= pagination.totalPages
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              下一页
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.totalPages }))}
              disabled={pagination.page >= pagination.totalPages}
              className={clsx(
                'px-3 py-2 rounded-lg border transition-colors',
                pagination.page >= pagination.totalPages
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              末页
            </button>
            <select
              value={pagination.pageSize}
              onChange={e => setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
              <option value={100}>100条/页</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

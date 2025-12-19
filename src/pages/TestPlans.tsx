import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  Play,
  Edit,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Archive,
  FileText,
  Target,
  Activity,
  BarChart3,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { clsx } from 'clsx';
import { testPlanService } from '../services/testPlanService';
import type { TestPlan, TestPlanStatus, TestPlanType } from '../types/testPlan';
import { showToast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/ui/modal';
import { SystemOption } from '../types/test';
import * as systemService from '../services/systemService';
export function TestPlans() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedPlanType, setSelectedPlanType] = useState<TestPlanType | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<TestPlanStatus | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TestPlan | null>(null);
  const [systemOptions, setSystemOptions] = useState<SystemOption[]>([]);
  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 加载测试计划列表
  const loadTestPlans = async () => {
    setLoading(true);
    try {
      const response = await testPlanService.getTestPlans({
        page: currentPage,
        pageSize,
        search: searchTerm || undefined,
        project: selectedProject || undefined,
        plan_type: selectedPlanType || undefined,
        status: selectedStatus || undefined,
      });
      
      setTestPlans(response.data);
      setTotal(response.total);
    } catch (error: any) {
      console.error('加载测试计划失败:', error);
      showToast.error('加载测试计划失败');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 新增：加载系统字典列表
  useEffect(() => {
    const loadSystems = async () => {
      try {
        const systems = await systemService.getActiveSystems();
        setSystemOptions(systems);
      } catch (error) {
        console.error('加载系统列表失败:', error);
        showToast.error('加载系统列表失败');
      }
    };
    loadSystems();
  }, []);
  
  useEffect(() => {
    loadTestPlans();
  }, [currentPage, searchTerm, selectedProject, selectedPlanType, selectedStatus]);

  // 创建测试计划
  const handleCreatePlan = () => {
    navigate('/test-plans/create');
  };

  // 查看测试计划详情
  const handleViewPlan = (plan: TestPlan) => {
    navigate(`/test-plans/${plan.id}`);
  };

  // 编辑测试计划
  const handleEditPlan = (plan: TestPlan) => {
    navigate(`/test-plans/${plan.id}/edit`);
  };

  // 执行测试计划
  const handleExecutePlan = (plan: TestPlan) => {
    navigate(`/test-plans/${plan.id}/execute`);
  };

  // 删除测试计划
  const handleDeletePlan = async () => {
    if (!selectedPlan) return;
    
    try {
      await testPlanService.deleteTestPlan(selectedPlan.id);
      showToast.success('测试计划已删除');
      setShowDeleteModal(false);
      setSelectedPlan(null);
      loadTestPlans();
    } catch (error: any) {
      console.error('删除测试计划失败:', error);
      showToast.error('删除测试计划失败');
    }
  };

  // 刷新功能 - 重新加载测试计划列表
  const handleSearch = () => {
    loadTestPlans();
    showToast.success('刷新成功');
  };

  // 重置功能 - 清空所有筛选条件
  const handleReset = () => {
    setSearchTerm('');
    setSelectedProject('');
    setSelectedPlanType('');
    setSelectedStatus('');
    setCurrentPage(1);
    showToast.success('已重置筛选条件');
  };

  // 获取状态标签
  const getStatusBadge = (status: TestPlanStatus) => {
    const statusConfig = {
      draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
      active: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
      completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
      cancelled: { label: '已取消', color: 'bg-red-100 text-red-700' },
      archived: { label: '已归档', color: 'bg-gray-100 text-gray-500' },
    };

    const config = statusConfig[status] || statusConfig.draft;
    
    return (
      <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', config.color)}>
        {config.label}
      </span>
    );
  };

  // 获取计划类型标签
  const getPlanTypeBadge = (type: TestPlanType) => {
    const typeConfig = {
      functional: { label: '功能测试', icon: FileText, color: 'bg-purple-100 text-purple-700' },
      ui_auto: { label: 'UI自动化', icon: Activity, color: 'bg-blue-100 text-blue-700' },
      mixed: { label: '混合测试', icon: Target, color: 'bg-indigo-100 text-indigo-700' },
      regression: { label: '回归测试', icon: BarChart3, color: 'bg-orange-100 text-orange-700' },
      smoke: { label: '冒烟测试', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
      integration: { label: '集成测试', icon: Users, color: 'bg-cyan-100 text-cyan-700' },
    };

    const config = typeConfig[type] || typeConfig.functional;
    const Icon = config.icon;
    
    return (
      <span className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', config.color)}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd', { locale: zhCN });
    } catch {
      return '-';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-0xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">测试计划</h1>
          <p className="text-gray-600">管理和执行测试计划</p>
        </div>
        {/* 新建按钮 */}
        <button
              onClick={handleCreatePlan}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              新建计划
            </button>
        </div>
        {/* 工具栏 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            {/* 搜索框 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索测试计划..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 筛选器 */}
            <div className="flex items-center gap-2">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">所有项目</option>
                {systemOptions.map(sys => (
              <option key={sys.id} value={sys.name}>{sys.name}</option>
            ))}
              </select>

              <select
                value={selectedPlanType}
                onChange={(e) => setSelectedPlanType(e.target.value as TestPlanType | '')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">所有类型</option>
                <option value="functional">功能测试</option>
                <option value="ui_auto">UI自动化</option>
                <option value="mixed">混合测试</option>
                <option value="regression">回归测试</option>
                <option value="smoke">冒烟测试</option>
                <option value="integration">集成测试</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as TestPlanStatus | '')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">所有状态</option>
                <option value="draft">草稿</option>
                <option value="active">进行中</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
                <option value="archived">已归档</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleSearch}
              className="flex items-center px-3 h-10 w-20 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors"
            >
              <Search className="h-4 w-4 mr-2" />
              刷新
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center px-3 h-10 w-20 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 focus:outline-none transition-colors"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              重置
            </button>
          </div>
        </div>

        {/* 测试计划列表 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : testPlans.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无测试计划</p>
              <button
                onClick={handleCreatePlan}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                创建第一个测试计划
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    所属项目
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    计划名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    计划类型
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    计划状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用例总数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    执行进度
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    负责人
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    计划时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {testPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {plan.project || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <button
                          onClick={() => handleViewPlan(plan)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 text-left truncate max-w-[450px]"
                          title={plan.name}
                        >
                          {plan.name}
                        </button>
                        {/* {plan.short_name && (
                          <span className="text-xs text-gray-500 truncate">{plan.short_name}</span>
                        )} */}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPlanTypeBadge(plan.plan_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(plan.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{plan.total_cases || 0}</span>
                        {plan.functional_cases !== undefined && plan.ui_auto_cases !== undefined && (
                          <span className="text-xs text-gray-400">
                            (功能:{plan.functional_cases} / UI:{plan.ui_auto_cases})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full">
                        {plan.completed_executions && plan.completed_executions > 0 ? (
                          <div>
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>已执行 {plan.completed_executions} 次</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">未执行</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {plan.owner_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(plan.start_date)} ~ {formatDate(plan.end_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleViewPlan(plan)}
                          className="text-blue-600 hover:text-blue-800"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExecutePlan(plan)}
                          className="text-green-600 hover:text-green-800"
                          title="执行计划"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditPlan(plan)}
                          className="text-yellow-600 hover:text-yellow-800"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPlan(plan);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 分页 */}
          {!loading && testPlans.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                共 {total} 条记录，第 {currentPage} / {Math.ceil(total / pageSize)} 页
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))}
                  disabled={currentPage >= Math.ceil(total / pageSize)}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteModal && selectedPlan && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="确认删除"
        >
          <div className="p-6">
            <p className="text-gray-700 mb-4">
              确定要删除测试计划 <span className="font-semibold">{selectedPlan.name}</span> 吗？
            </p>
            <p className="text-sm text-gray-500 mb-6">
              删除后可以在归档中恢复
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDeletePlan}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                删除
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


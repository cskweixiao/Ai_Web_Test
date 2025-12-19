import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Plus,
  Trash2,
  FileText,
  Activity,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  Archive,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronsLeft,
  ChevronRight as ChevronRightIcon,
  ChevronsRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { clsx } from 'clsx';
import { testPlanService } from '../services/testPlanService';
import { functionalTestCaseService } from '../services/functionalTestCaseService';
import { testService } from '../services/testService';
import type { TestPlan, TestPlanCase, TestPlanExecution, TestPlanStatistics } from '../types/testPlan';
import { showToast } from '../utils/toast';
import { Modal } from '../components/ui/modal';
import { TestPlanExecutionLogModal } from '../components/TestPlanExecutionLogModal';
import { FunctionalCaseSelectModal } from '../components/FunctionalCaseSelectModal';
import { getCaseTypeInfo } from '../utils/caseTypeHelper';

export function TestPlanDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TestPlan | null>(null);
  const [cases, setCases] = useState<TestPlanCase[]>([]);
  const [executions, setExecutions] = useState<TestPlanExecution[]>([]);
  const [statistics, setStatistics] = useState<TestPlanStatistics | null>(null);
  
  const [activeTab, setActiveTab] = useState<'cases' | 'executions' | 'statistics'>('cases');
  const [showAddCaseModal, setShowAddCaseModal] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<number>>(new Set());
  
  // 分页状态
  const [casePagination, setCasePagination] = useState({
    page: 1,
    pageSize: 10,
  });
  
  // 🔥 新增：弹窗模式添加用例相关状态
  const [showAddCaseModalInline, setShowAddCaseModalInline] = useState(false);
  const [addCaseType, setAddCaseType] = useState<'functional' | 'ui_auto'>('functional');
  const [availableCases, setAvailableCases] = useState<Array<{
    id: number;
    name?: string;
    title?: string;
    description?: string;
    system?: string;
    module?: string;
    scenario_name?: string;
    case_type?: string;
    priority?: string;
    tags?: string[];
    project_version_id?: number;
    project_version?: {
      id?: number;
      version_name?: string;
      version_code?: string;
    };
  }>>([]);
  const [selectedNewCases, setSelectedNewCases] = useState<Set<number>>(new Set());
  const [addCaseLoading, setAddCaseLoading] = useState(false);
  const [addCaseSaving, setAddCaseSaving] = useState(false);
  const [addCaseSearchTerm, setAddCaseSearchTerm] = useState('');
  const [addCaseFilterSystem, setAddCaseFilterSystem] = useState('');
  const [addCaseFilterProjectVersion, setAddCaseFilterProjectVersion] = useState('');
  const [addCaseFilterModule, setAddCaseFilterModule] = useState('');
  const [addCaseFilterScenario, setAddCaseFilterScenario] = useState('');
  const [addCaseFilterCaseType, setAddCaseFilterCaseType] = useState('');
  const [addCaseFilterPriority, setAddCaseFilterPriority] = useState('');
  // 🔥 新增：分页状态
  const [addCasePagination, setAddCasePagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  
  // 执行日志模态框
  const [showExecutionLogModal, setShowExecutionLogModal] = useState(false);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  
  // 加载测试计划详情
  const loadTestPlanDetail = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await testPlanService.getTestPlanDetail(parseInt(id));
      setPlan(response.plan);
      setCases(response.cases);
      setExecutions(response.executions);
      setStatistics(response.statistics);
    } catch (error) {
      console.error('加载测试计划详情失败:', error);
      showToast.error('加载测试计划详情失败');
      navigate('/test-plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTestPlanDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 执行测试计划
  const handleExecute = (caseType: 'functional' | 'ui_auto') => {
    navigate(`/test-plans/${id}/execute?type=${caseType}`);
  };

  // 添加用例（跳转页面）
  const handleAddCases = () => {
    setShowAddCaseModal(true);
    // navigate(`/test-plans/${id}/add-cases?type=functional`);
  };

  // 🔥 新增：弹窗模式添加用例
  const handleAddCasesModal = (type: 'functional' | 'ui_auto') => {
    setAddCaseType(type);
    setShowAddCaseModalInline(true);
    // 重置分页和搜索条件
    setAddCasePagination({
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    });
    setAddCaseSearchTerm('');
    setAddCaseFilterModule('');
    setAddCaseFilterPriority('');
    loadAvailableCases(type, { page: 1, pageSize: 10, search: '' });
  };

  // 🔥 新增：加载可用的用例列表
  const loadAvailableCases = async (type: 'functional' | 'ui_auto', options?: { page?: number; pageSize?: number; search?: string }) => {
    setAddCaseLoading(true);
    try {
      const page = options?.page || addCasePagination.page;
      const pageSize = options?.pageSize || addCasePagination.pageSize;
      const search = options?.search !== undefined ? options.search : addCaseSearchTerm;

      if (type === 'functional') {
        // 加载功能测试用例
        const response = await functionalTestCaseService.getList({
          page,
          pageSize,
          search,
        }) as { success?: boolean; data?: Array<{
          id: number;
          name?: string;
          title?: string;
          description?: string;
          system?: string;
          module?: string;
          scenario_name?: string;
          case_type?: string;
          priority?: string;
          tags?: string[];
          project_version_id?: number;
          project_version?: {
            id?: number;
            version_name?: string;
            version_code?: string;
          };
        }>; pagination?: { page: number; pageSize: number; total: number; totalPages: number } };
        
        const data = response.success ? (response.data || []) : [];
        setAvailableCases(data);
        
        // 更新分页信息
        if (response.pagination) {
          console.log('📄 [TestPlanDetail] 收到分页信息:', response.pagination);
          setAddCasePagination(response.pagination);
        } else {
          console.warn('⚠️ [TestPlanDetail] 后端未返回分页信息');
          // 如果没有分页信息，根据数据计算
          setAddCasePagination({
            page: 1,
            pageSize: data.length,
            total: data.length,
            totalPages: 1
          });
        }
      } else {
        // 加载UI自动化用例
        const response = await testService.getTestCases() as Array<{
          id: number;
          name?: string;
          title?: string;
          description?: string;
          module?: string;
          priority?: string;
          tags?: string[];
        }>;
        setAvailableCases(response);
        
        // UI自动化暂时使用客户端分页
        setAddCasePagination({
          page: 1,
          pageSize: response.length,
          total: response.length,
          totalPages: 1
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('加载用例列表失败:', error);
      showToast.error('加载用例列表失败: ' + errorMessage);
    } finally {
      setAddCaseLoading(false);
    }
  };

  // 🔥 新增：添加选中的用例
  const handleConfirmAddCases = async () => {
    if (selectedNewCases.size === 0) {
      showToast.warning('请至少选择一个用例');
      return;
    }

    setAddCaseSaving(true);
    try {
      const casesToAdd = Array.from(selectedNewCases).map((caseId) => {
        const caseItem = availableCases.find((c: { id: number }) => c.id === caseId)!;
        return {
          case_id: caseId,
          case_type: addCaseType,
          case_name: (caseItem as { name?: string; title?: string }).name || (caseItem as { name?: string; title?: string }).title || '',
        };
      });

      await testPlanService.addCasesToPlan(parseInt(id!), casesToAdd);
      showToast.success(`成功添加 ${casesToAdd.length} 个用例`);
      
      // 关闭弹窗并重置状态
      setShowAddCaseModalInline(false);
      setSelectedNewCases(new Set());
      setAddCaseSearchTerm('');
      setAddCaseFilterSystem('');
      setAddCaseFilterProjectVersion('');
      setAddCaseFilterModule('');
      setAddCaseFilterScenario('');
      setAddCaseFilterCaseType('');
      setAddCaseFilterPriority('');
      
      // 重新加载测试计划详情
      loadTestPlanDetail();
    } catch (error) {
      console.error('添加用例失败:', error);
      showToast.error('添加用例失败');
    } finally {
      setAddCaseSaving(false);
    }
  };

  // 移除用例
  const handleRemoveCase = async (caseItem: TestPlanCase) => {
    if (!window.confirm(`确定要移除用例 "${caseItem.case_name}" 吗？`)) {
      return;
    }

    try {
      await testPlanService.removeCaseFromPlan(parseInt(id!), caseItem.case_id, caseItem.case_type);
      showToast.success('用例已移除');
      loadTestPlanDetail();
      // 从选中列表中移除
      setSelectedCaseIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(caseItem.id);
        return newSet;
      });
    } catch (error) {
      console.error('移除用例失败:', error);
      showToast.error('移除用例失败');
    }
  };

  // 切换单个用例选中状态
  const handleToggleCaseSelection = (caseId: number) => {
    setSelectedCaseIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  // 全选/取消全选
  const handleToggleAllSelection = () => {
    // 只选择当前页的用例
    const currentPageCases = getCurrentPageCases();
    const currentPageIds = new Set(currentPageCases.map(c => c.id));
    const allCurrentPageSelected = currentPageCases.every(c => selectedCaseIds.has(c.id));
    
    if (allCurrentPageSelected) {
      // 取消当前页的选择
      setSelectedCaseIds(prev => {
        const newSet = new Set(prev);
        currentPageIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      // 选中当前页所有用例
      setSelectedCaseIds(prev => {
        const newSet = new Set(prev);
        currentPageIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  };

  // 获取当前页的用例
  const getCurrentPageCases = () => {
    const start = (casePagination.page - 1) * casePagination.pageSize;
    const end = start + casePagination.pageSize;
    return cases.slice(start, end);
  };

  // 计算分页信息
  const getPaginationInfo = () => {
    const total = cases.length;
    const totalPages = Math.max(1, Math.ceil(total / casePagination.pageSize));
    return {
      page: casePagination.page,
      pageSize: casePagination.pageSize,
      total,
      totalPages,
    };
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    const totalPages = Math.ceil(cases.length / casePagination.pageSize);
    if (page >= 1 && page <= totalPages) {
      setCasePagination(prev => ({ ...prev, page }));
    }
  };

  // 处理每页条数变化
  const handlePageSizeChange = (pageSize: number) => {
    setCasePagination({ page: 1, pageSize });
    // 重置选中状态，因为页码变化了
    setSelectedCaseIds(new Set());
  };

  // CaseTypeBadge 组件
  const getCaseTypeConfig = (caseType: string) => {
    const typeInfo = getCaseTypeInfo(caseType);
    return { 
      color: typeInfo.color, 
      bg: typeInfo.bgColor, 
      text: `${typeInfo.emoji} ${typeInfo.label}` 
    };
  };

  const CaseTypeBadge: React.FC<{ caseType: string }> = ({ caseType }) => {
    const config = getCaseTypeConfig(caseType);

    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
        style={{
          backgroundColor: config.bg,
          color: config.color
        }}
      >
        {config.text}
      </span>
    );
  };

  // 批量删除用例
  const handleBatchDelete = async () => {
    if (selectedCaseIds.size === 0) {
      showToast.warning('请先选择要删除的用例');
      return;
    }

    const selectedCases = cases.filter(c => selectedCaseIds.has(c.id));
    const caseNames = selectedCases.map(c => c.case_name).join('、');
    
    if (!window.confirm(`确定要删除选中的 ${selectedCaseIds.size} 个用例吗？\n\n${caseNames}`)) {
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (const caseItem of selectedCases) {
        try {
          await testPlanService.removeCaseFromPlan(parseInt(id!), caseItem.case_id, caseItem.case_type);
          successCount++;
        } catch (error) {
          console.error(`删除用例 "${caseItem.case_name}" 失败:`, error);
          failCount++;
        }
      }

      if (failCount === 0) {
        showToast.success(`成功删除 ${successCount} 个用例`);
      } else {
        showToast.warning(`成功删除 ${successCount} 个用例，${failCount} 个删除失败`);
      }

      setSelectedCaseIds(new Set());
      loadTestPlanDetail();
    } catch (error) {
      console.error('批量删除用例失败:', error);
      showToast.error('批量删除用例失败');
    } finally {
      setLoading(false);
    }
  };

  // 批量执行用例
  const handleBatchExecute = () => {
    if (selectedCaseIds.size === 0) {
      showToast.warning('请先选择要执行的用例');
      return;
    }

    const selectedCases = cases.filter(c => selectedCaseIds.has(c.id));
    const hasFunctional = selectedCases.some(c => c.case_type === 'functional');
    const hasUiAuto = selectedCases.some(c => c.case_type === 'ui_auto');

    // 如果选中了不同类型的用例，提示用户
    if (hasFunctional && hasUiAuto) {
      showToast.warning('无法同时执行功能测试和UI自动化测试，请分别选择执行');
      return;
    }

    // 确定执行类型
    const caseType = hasFunctional ? 'functional' : 'ui_auto';
    
    // 将选中的用例ID传递到执行页面
    const caseIds = Array.from(selectedCaseIds).join(',');
    navigate(`/test-plans/${id}/execute?type=${caseType}&caseIds=${caseIds}`);
  };

  // 查看执行日志
  const handleViewExecutionLog = (executionId: string) => {
    setCurrentExecutionId(executionId);
    setShowExecutionLogModal(true);
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      // return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm', { locale: zhCN });
    } catch {
      return '-';
    }
  };

  // 获取状态中文
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: '草稿',
      active: '进行中',
      completed: '已完成',
      cancelled: '已取消',
      archived: '已归档',
    };
    return statusMap[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-5 w-5 text-gray-600" />;
      case 'active':
        return <Activity className="h-5 w-5 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'archived':
        return <Archive className="h-5 w-5 text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      archived: 'bg-gray-100 text-gray-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  // 获取类型中文
  const getPlanTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      functional: '功能测试',
      ui_auto: 'UI自动化',
      mixed: '混合测试',
      regression: '回归测试',
      smoke: '冒烟测试',
      integration: '集成测试',
    };
    return typeMap[type] || type;
  };

  // 获取执行结果标签
  const getResultBadge = (result?: string) => {
    if (!result) return <span className="text-gray-500">未执行</span>;
    
    const resultConfig = {
      pass: { label: '通过', color: 'text-green-600' },
      fail: { label: '失败', color: 'text-red-600' },
      block: { label: '阻塞', color: 'text-yellow-600' },
      skip: { label: '跳过', color: 'text-gray-600' },
    };

    const config = resultConfig[result as keyof typeof resultConfig] || { label: result, color: 'text-gray-600' };
    
    return <span className={clsx('font-medium', config.color)}>{config.label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-5">
            <button
              onClick={() => navigate('/test-plans')}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              返回列表
            </button>
            <div>
              <div className="text-3xl font-bold text-gray-900 truncate max-w-[1000px]" title={plan.name}>{plan.name}</div>
              {plan.description && (
                <p className="text-gray-600">{plan.description}</p>
              )}
            </div>
            </div>
            <div className={clsx('px-4 py-2 rounded-lg flex items-center gap-2', getStatusColor(plan.status))}>
              {getStatusIcon(plan.status)}
              <span className="font-medium">{getStatusText(plan.status)}</span>
            </div>
            {/* <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleEdit}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4" />
                编辑
              </button>
              <button
                onClick={() => handleExecute('functional')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                <Play className="w-4 h-4" />
                执行功能测试
              </button>
              <button
                onClick={() => handleExecute('ui_auto')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                <Play className="w-4 h-4" />
                执行UI自动化
              </button>
            </div> */}
          </div>
        </div>

        {/* 计划概览 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          {/* <div className="grid grid-cols-4 gap-6"> */}
          <div className="flex items-center justify-between gap-6">
          <div>
              <div className="text-sm text-gray-500 mb-1">所属项目</div>
              <div className="text-lg font-semibold text-gray-800">{plan.project}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">计划类型</div>
              <div className="text-lg font-semibold text-gray-800">{getPlanTypeText(plan.plan_type)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">计划简称</div>
              <div className="text-lg font-bold text-gray-800">{plan.short_name}</div>
            </div>
            {/* <div>
              <div className="text-sm text-gray-500 mb-1">计划状态</div>
              <div className="text-lg font-semibold">{getStatusText(plan.status)}</div>
            </div> */}
            {/* <div>
              <div className="text-sm text-gray-500 mb-1">负责人</div>
              <div className="text-lg font-semibold">{plan.owner_name}</div>
            </div> */}
            {/* <div>
              <div className="text-sm text-gray-500 mb-1">用例总数</div>
              <div className="text-lg font-semibold">{statistics?.total_cases || 0}</div>
            </div>  */}
            <div>
              <div className="text-sm text-gray-500 mb-1">计划时间</div>
              <div className="text-lg font-bold text-gray-800">{formatDate(plan.start_date)} ~ {formatDate(plan.end_date)}</div>
            </div>
          </div>
          
          {/* 计划时间和描述放一行 */}
          {/* <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap">
                <Calendar className="w-4 h-4" />
                计划时间: {formatDate(plan.start_date)} ~ {formatDate(plan.end_date)}
                {plan.owner_name && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">负责人: </span>
                  <span className="text-sm text-gray-700">{plan.owner_name}</span>
                  <User className="w-4 h-4" />
                  {plan.owner_name}
                </div>
                )}
                {plan.description && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">描述: </span>
                  <span className="text-sm text-gray-700">{plan.description}</span>
                  <BookOpen className="w-4 h-4" />
                  {plan.description}
                </div>
                )}
              </div>
            </div>
          </div> */}
          {/* 计划时间和描述放一行 */}
          {/* <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-6">
              <div className="flex items-center gap-12 text-sm text-gray-500 whitespace-nowrap">
                <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(plan.start_date)} ~ {formatDate(plan.end_date)}
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {plan.description}
                </div>
              </div>
            </div>
            </div> */}
        </div>

        {/* 标签页 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between gap-1 p-2">
              <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('cases')}
                className={clsx(
                  'px-4 py-2 rounded-lg transition-colors',
                  activeTab === 'cases'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  测试用例 ({statistics?.total_cases || 0})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('executions')}
                className={clsx(
                  'px-4 py-2 rounded-lg transition-colors',
                  activeTab === 'executions'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  执行历史 ({executions.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('statistics')}
                className={clsx(
                  'px-4 py-2 rounded-lg transition-colors',
                  activeTab === 'statistics'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  统计分析
                </div>
              </button>
              </div>
              <div className="flex items-center gap-4">
                {activeTab === 'cases' && selectedCaseIds.size >= 0 && (
                  <>
                    {/* <div className="text-sm text-gray-600">
                      已选择 {selectedCaseIds.size} 项
                    </div> */}
                    {/* <button
                      onClick={handleBatchExecute}
                      disabled={selectedCaseIds.size === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-[13px]"
                    >
                      <Play className="w-4 h-4" />
                      批量执行
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      disabled={selectedCaseIds.size === 0}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-[13px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      批量删除
                    </button> */}

                  </>
                )}
                {/* <button
                  onClick={handleAddCases}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  添加用例
                </button> */}
                <button
                  onClick={() => handleAddCasesModal('functional')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-[13px]"
                >
                  <Plus className="w-4 h-3.5" />
                  关联用例
                </button>
                <button
                      onClick={handleBatchDelete}
                      disabled={selectedCaseIds.size === 0}
                      className={clsx("inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-[13px]", selectedCaseIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer')}
                    >
                      <Trash2 className="w-4 h-3.5" />
                      {selectedCaseIds.size > 0 ? `批量删除 ${selectedCaseIds.size} 项` : '批量删除'}
                    </button>
                <button
                      onClick={handleBatchExecute}
                      disabled={selectedCaseIds.size === 0}
                      className={clsx("inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-[13px]", selectedCaseIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer')}
                      >
                      <Play className="w-4 h-3.5" />
                      {selectedCaseIds.size > 0 ? `批量执行 ${selectedCaseIds.size} 项` : '批量执行'}
                    </button>
                    
                <button
                  onClick={() => handleExecute('functional')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-[13px]"
                >
                  <Play className="w-4 h-3.5" />
                  执行所有
                </button>
                {/* <Button
                  style={{ width: '100px', height: '32px', borderRadius: '8px', fontSize: '13px', gap: '2px' }}
                  type="primary"
                  onClick={handleAddCases}
                  icon={<Plus className="w-4 h-3.5" />}
                >
                  关联用例
                </Button>
                <Button
                  // size="small"
                  style={{ width: '100px', height: '32px', borderRadius: '8px', fontSize: '13px', gap: '2px' }}
                  type="primary"
                  onClick={handleBatchDelete}
                  disabled={selectedCaseIds.size === 0}
                  icon={<Trash2 className="w-4 h-3.5" />}
                  danger={true}
                >
                  批量删除
                </Button>
                <Button
                  style={{ width: '100px', height: '32px', borderRadius: '8px', fontSize: '13px', gap: '2px' }}
                  type="primary"
                  onClick={handleBatchExecute}
                  disabled={selectedCaseIds.size === 0}
                  icon={<Play className="w-4 h-3.5" />}
                >
                  批量执行
                </Button>
                <Button
                  style={{ width: '100px', height: '32px', borderRadius: '8px', fontSize: '13px', gap: '2px' }}
                  type="primary"
                  onClick={() => handleExecute('functional')}
                  icon={<Play className="w-4 h-3.5" />}
                >
                  执行所有
                </Button> */}
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* 测试用例列表 */}
            {activeTab === 'cases' && (
              <div>
                {/* <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">测试用例列表</h3>
                  <button
                    onClick={handleAddCases}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    添加用例
                  </button>
                </div> */}

                {cases.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">还没有添加测试用例</p>
                    <button
                      onClick={handleAddCases}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      <Plus className="w-4 h-4" />
                      添加用例
                    </button>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">
                            <button
                              onClick={handleToggleAllSelection}
                              className="flex items-center justify-center w-5 h-5 hover:bg-gray-200 rounded"
                              title={(() => {
                                const currentPageCases = getCurrentPageCases();
                                const allCurrentPageSelected = currentPageCases.length > 0 && currentPageCases.every(c => selectedCaseIds.has(c.id));
                                return allCurrentPageSelected ? '取消全选' : '全选当前页';
                              })()}
                            >
                              {(() => {
                                const currentPageCases = getCurrentPageCases();
                                const allCurrentPageSelected = currentPageCases.length > 0 && currentPageCases.every(c => selectedCaseIds.has(c.id));
                                return allCurrentPageSelected ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400" />
                                );
                              })()}
                            </button>
                          </th>
                          <th className="px-1 py-2 text-left text-xs font-medium text-gray-500 uppercase">序号</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用例名称</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用例类型</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">执行状态</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">执行结果</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {getCurrentPageCases().map((caseItem, index) => {
                          const isSelected = selectedCaseIds.has(caseItem.id);
                          const globalIndex = (casePagination.page - 1) * casePagination.pageSize + index;
                          return (
                            <tr 
                              key={caseItem.id} 
                              className={clsx("hover:bg-gray-50", isSelected && "bg-blue-50")}
                            >
                              <td className="px-1 py-3">
                                <button
                                  onClick={() => handleToggleCaseSelection(caseItem.id)}
                                  className="flex items-center justify-center w-5 h-5 hover:bg-gray-200 rounded"
                                  title={isSelected ? '取消选择' : '选择'}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-gray-400" />
                                  )}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{globalIndex + 1}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {caseItem.case_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {caseItem.case_type === 'functional' ? '功能测试' : 'UI自动化'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {caseItem.is_executed ? (
                                  <span className="text-green-600">已执行</span>
                                ) : (
                                  <span className="text-gray-500">未执行</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {getResultBadge(caseItem.execution_result)}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <button
                                  onClick={() => handleRemoveCase(caseItem)}
                                  className="text-red-600 hover:text-red-800"
                                  title="移除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    
                    {/* 分页控件 */}
                    {cases.length > 0 && (() => {
                      const paginationInfo = getPaginationInfo();
                      return (
                        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50">
                          {/* 中间：页码信息 */}
                          <div className="text-sm text-gray-500">
                            共 <span className="font-semibold text-gray-700">{paginationInfo.total}</span> 条记录，
                            第 <span className="font-semibold text-gray-700">{paginationInfo.page}</span> / <span className="font-semibold text-gray-700">{paginationInfo.totalPages}</span> 页
                          </div>
                          <div className="flex space-x-4">
                            {/* 右侧：分页按钮 */}
                            <div className="flex items-center space-x-1">
                              {/* 第一页 */}
                              <button
                                onClick={() => handlePageChange(1)}
                                disabled={paginationInfo.page === 1}
                                className={clsx(
                                  'p-2 rounded',
                                  paginationInfo.page === 1
                                    ? 'text-gray-600 cursor-not-allowed'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                )}
                                title="第一页"
                              >
                                <ChevronsLeft className="h-4 w-4" />
                              </button>

                              {/* 上一页 */}
                              <button
                                onClick={() => handlePageChange(paginationInfo.page - 1)}
                                disabled={paginationInfo.page === 1}
                                className={clsx(
                                  'p-2 rounded',
                                  paginationInfo.page === 1
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
                                  max={paginationInfo.totalPages}
                                  value={paginationInfo.page}
                                  onChange={(e) => {
                                    const page = parseInt(e.target.value);
                                    if (page >= 1 && page <= paginationInfo.totalPages) {
                                      handlePageChange(page);
                                    }
                                  }}
                                  className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  aria-label="页码"
                                  title="输入页码"
                                />
                                <span className="text-sm text-gray-500">/ {paginationInfo.totalPages}</span>
                              </div>

                              {/* 下一页 */}
                              <button
                                onClick={() => handlePageChange(paginationInfo.page + 1)}
                                disabled={paginationInfo.page === paginationInfo.totalPages}
                                className={clsx(
                                  'p-2 rounded',
                                  paginationInfo.page === paginationInfo.totalPages
                                    ? 'text-gray-600 cursor-not-allowed'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                )}
                                title="下一页"
                              >
                                <ChevronRightIcon className="h-4 w-4" />
                              </button>

                              {/* 最后一页 */}
                              <button
                                onClick={() => handlePageChange(paginationInfo.totalPages)}
                                disabled={paginationInfo.page === paginationInfo.totalPages}
                                className={clsx(
                                  'p-2 rounded',
                                  paginationInfo.page === paginationInfo.totalPages
                                    ? 'text-gray-600 cursor-not-allowed'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                )}
                                title="最后一页"
                              >
                                <ChevronsRight className="h-4 w-4" />
                              </button>
                            </div>

                            {/* 左侧：每页条数选择器 */}
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">每页显示</span>
                              <select
                                value={paginationInfo.pageSize}
                                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                style={{ width: '80px' }}
                                aria-label="每页显示条数"
                                title="选择每页显示的条数"
                              >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                              </select>
                              <span className="text-sm text-gray-700">条</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* 执行历史 */}
            {activeTab === 'executions' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">执行历史</h3>
                {executions.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">还没有执行记录</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {executions.map((execution) => (
                      <div
                        key={execution.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {execution.execution_type === 'functional' ? '功能测试执行' : 'UI自动化执行'}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              执行人: {execution.executor_name} | 执行时间: {formatDate(execution.started_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium">
                              {execution.status === 'completed' ? (
                                <span className="text-green-600">已完成</span>
                              ) : execution.status === 'running' ? (
                                <span className="text-blue-600">执行中</span>
                              ) : execution.status === 'failed' ? (
                                <span className="text-red-600">失败</span>
                              ) : (
                                <span className="text-gray-600">{execution.status}</span>
                              )}
                            </div>
                            {execution.status === 'completed' && (
                              <button
                                onClick={() => handleViewExecutionLog(execution.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                title="查看执行日志"
                              >
                                <FileText className="w-4 h-4" />
                                查看日志
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-6 gap-4 mt-3 pt-3 border-t border-gray-200 text-sm">
                          <div>
                            <div className="text-gray-500">总用例</div>
                            <div className="font-medium">{execution.total_cases}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">已完成</div>
                            <div className="font-medium">{execution.completed_cases}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">通过</div>
                            <div className="font-medium text-green-600">{execution.passed_cases}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">失败</div>
                            <div className="font-medium text-red-600">{execution.failed_cases}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">阻塞</div>
                            <div className="font-medium text-yellow-600">{execution.blocked_cases}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">进度</div>
                            <div className="font-medium">{execution.progress}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 统计分析 */}
            {activeTab === 'statistics' && statistics && (
              <div>
                <h3 className="text-lg font-semibold mb-4">统计分析</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-blue-700">用例总数</div>
                      <Target className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-900">{statistics.total_cases}</div>
                    <div className="text-xs text-blue-600 mt-1">
                      功能 {statistics.functional_cases} | UI {statistics.ui_auto_cases}
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-green-700">通过率</div>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-900">
                      {statistics.pass_rate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      通过 {statistics.passed_cases} / 执行 {statistics.executed_cases}
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-purple-700">执行率</div>
                      <Activity className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-900">
                      {statistics.execution_rate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-purple-600 mt-1">
                      已执行 {statistics.executed_cases} / 总数 {statistics.total_cases}
                    </div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-red-700">失败用例</div>
                      <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="text-2xl font-bold text-red-900">{statistics.failed_cases}</div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-yellow-700">阻塞用例</div>
                      <XCircle className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="text-2xl font-bold text-yellow-900">{statistics.blocked_cases}</div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-700">执行次数</div>
                      <Clock className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{statistics.total_executions}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 添加用例对话框 */}
      {showAddCaseModal && (
        <Modal
          isOpen={showAddCaseModal}
          onClose={() => setShowAddCaseModal(false)}
          title="添加测试用例"
        >
          <div className="p-6">
            <p className="text-gray-700 mb-4">
              选择要添加的用例类型，然后进入用例选择页面
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  navigate(`/test-plans/${id}/add-cases?type=functional`);
                }}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-purple-600" />
                  <div>
                    <div className="font-medium">功能测试用例</div>
                    <div className="text-sm text-gray-500">手动执行的功能测试用例</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => {
                  navigate(`/test-plans/${id}/add-cases?type=ui_auto`);
                }}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Activity className="w-6 h-6 text-blue-600" />
                  <div>
                    <div className="font-medium">UI自动化用例</div>
                    <div className="text-sm text-gray-500">自动化执行的UI测试用例</div>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowAddCaseModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 执行日志模态框 */}
      {showExecutionLogModal && currentExecutionId && (
        <TestPlanExecutionLogModal
          isOpen={showExecutionLogModal}
          onClose={() => {
            setShowExecutionLogModal(false);
            setCurrentExecutionId(null);
          }}
          executionId={currentExecutionId}
        />
      )}

      {/* 🔥 新增：弹窗模式添加用例 - 使用统一组件 */}
      {showAddCaseModalInline && (
        <FunctionalCaseSelectModal
          isOpen={showAddCaseModalInline}
          onClose={() => {
            setShowAddCaseModalInline(false);
            setSelectedNewCases(new Set());
            setAddCaseSearchTerm('');
            setAddCaseFilterSystem('');
            setAddCaseFilterProjectVersion('');
            setAddCaseFilterModule('');
            setAddCaseFilterScenario('');
            setAddCaseFilterCaseType('');
            setAddCaseFilterPriority('');
          }}
          title={`添加${addCaseType === 'functional' ? '功能测试' : 'UI自动化'}用例`}
          cases={availableCases.map(c => ({
            id: c.id,
            name: c.name || c.title || '',
            description: c.description,
            priority: c.priority,
            case_type: c.case_type || addCaseType,
            system: c.system,
            module: c.module,
            scenario_name: c.scenario_name,
            tags: c.tags,
            project_version_id: c.project_version_id,
            project_version: c.project_version,
          }))}
          selectedCaseIds={selectedNewCases}
          onSelectedCasesChange={(ids) => setSelectedNewCases(ids as Set<number>)}
          loading={addCaseLoading}
          searchTerm={addCaseSearchTerm}
          onSearchChange={setAddCaseSearchTerm}
          onSearch={() => loadAvailableCases(addCaseType, { page: 1, search: addCaseSearchTerm })}
          pagination={addCasePagination}
          onPageChange={(page) => loadAvailableCases(addCaseType, { page })}
          onPageSizeChange={(pageSize) => loadAvailableCases(addCaseType, { page: 1, pageSize })}
          onConfirm={handleConfirmAddCases}
          confirmText="添加选中的用例"
          confirmDisabled={addCaseSaving}
          confirmLoading={addCaseSaving}
          showViewToggle={true}
          defaultViewMode="list"
          CaseTypeBadge={CaseTypeBadge}
          filters={[
            {
              key: 'system',
              label: '所属系统',
              value: addCaseFilterSystem,
              onChange: setAddCaseFilterSystem,
              placeholder: '所有系统'
            },
            {
              key: 'project_version_id',
              label: '所属版本',
              value: addCaseFilterProjectVersion,
              onChange: setAddCaseFilterProjectVersion,
              placeholder: '所有版本'
            },
            {
              key: 'scenario_name',
              label: '所属场景',
              value: addCaseFilterScenario,
              onChange: setAddCaseFilterScenario,
              placeholder: '所有场景'
            },
            {
              key: 'module',
              label: '所属模块',
              value: addCaseFilterModule,
              onChange: setAddCaseFilterModule,
              placeholder: '所有模块'
            },
            {
              key: 'case_type',
              label: '用例类型',
              value: addCaseFilterCaseType,
              onChange: setAddCaseFilterCaseType,
              options: ['SMOKE', 'FULL', 'ABNORMAL', 'BOUNDARY', 'PERFORMANCE', 'SECURITY', 'USABILITY', 'COMPATIBILITY', 'RELIABILITY'],
              optionLabels: {
                SMOKE: '🔥 冒烟',
                FULL: '📋 全量',
                ABNORMAL: '⚠️ 异常',
                BOUNDARY: '📏 边界',
                PERFORMANCE: '⚡ 性能',
                SECURITY: '🔒 安全',
                USABILITY: '👤 可用性',
                COMPATIBILITY: '🔄 兼容性',
                RELIABILITY: '💪 可靠性'
              },
              placeholder: '所有类型'
            },
            {
              key: 'priority',
              label: '优先级',
              value: addCaseFilterPriority,
              onChange: setAddCaseFilterPriority,
              options: ['high', 'medium', 'low'],
              optionLabels: { high: '高', medium: '中', low: '低' },
              placeholder: '所有优先级'
            }
          ]}
          useSet={true}
        />
      )}
    </div>
  );
}

